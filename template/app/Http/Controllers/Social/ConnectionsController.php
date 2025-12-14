<?php

namespace App\Http\Controllers\Social;

use App\Http\Controllers\Controller;
use App\Models\Connection;
use App\Models\User;
use App\Services\Social\ConnectionAnalyticsService;
use App\Services\Social\SocialInsightsService;
use App\Services\SocialDataBackboneService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

final class ConnectionsController extends Controller
{
    private array $connectionCache = [];

    public function __construct(
        private readonly ConnectionAnalyticsService $analytics,
        private readonly SocialInsightsService $insights,
        private readonly SocialDataBackboneService $backbone
    ) {
        $this->middleware(['auth:sanctum']);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $connections = Connection::query()
            ->with(['user:id,name', 'connectedUser:id,name'])
            ->where(function ($query) use ($user) {
                $query->where('user_id', $user->id)
                    ->orWhere('connected_user_id', $user->id);
            })
            ->orderByDesc('updated_at')
            ->get();

        $grouped = collect(Connection::allowedStatuses())
            ->mapWithKeys(fn (string $status) => [$status => collect()]);

        foreach ($connections as $connection) {
            $grouped[$connection->status] = $grouped[$connection->status]->push(
                $this->formatConnection($connection, $user->id)
            );
        }

        $counts = $this->analytics->lifecycleBreakdown($user);

        return response()->json([
            'data' => $grouped->map(fn (Collection $items) => $items->values())->map->all(),
            'counts' => $counts,
            'meta' => [
                'generated_at' => now()->toIso8601String(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $payload = $request->validate([
            'target_user_id' => ['required_without:target_email', 'integer', 'exists:users,id'],
            'target_email' => ['required_without:target_user_id', 'email'],
            'note' => ['nullable', 'string', 'max:600'],
            'type' => ['nullable', 'string', 'max:60'],
        ]);

        $limit = $this->analytics->enforceRateLimit($user);
        if (! $limit['allowed']) {
            return response()->json([
                'message' => 'You have reached the current invite limit.',
                'reason' => $limit['reason'],
                'retry_after' => $limit['retry_after'],
                'limits' => $limit['limits'],
            ], 429);
        }

        $target = $this->resolveTargetUser($user, $payload);
        if (! $target) {
            return response()->json([
                'message' => 'We could not find that profile yet.',
            ], 422);
        }

        $existing = $this->existingConnection($user->id, $target->id);
        if ($existing) {
            $response = $this->handleExistingConnection($existing, $user, $target);
            if ($response instanceof JsonResponse) {
                return $response;
            }
        }

        $connection = Connection::query()->create([
            'user_id' => $user->id,
            'connected_user_id' => $target->id,
            'status' => Connection::STATUS_PENDING,
            'type' => $payload['type'] ?? 'manual_invite',
            'initiator_id' => $user->id,
        ]);

        $context = array_filter([
            'note' => $payload['note'] ?? null,
            'type' => $payload['type'] ?? null,
        ], fn ($value) => $value !== null && $value !== '');

        $this->analytics->recordAudit($user, $target, 'connection.created', $connection, $context);

        return response()->json([
            'message' => 'Invite sent.',
            'connection' => $this->formatConnection($connection, $user->id),
            'rate_limit' => $limit,
        ], 201);
    }

    public function update(Request $request, Connection $connection): JsonResponse
    {
        $user = $request->user();
        if ($connection->user_id !== $user->id && $connection->connected_user_id !== $user->id) {
            return response()->json(['message' => 'You cannot modify this connection.'], 403);
        }

        $data = $request->validate([
            'status' => [
                'required',
                Rule::in([
                    Connection::STATUS_ACCEPTED,
                    Connection::STATUS_SNOOZED,
                    Connection::STATUS_BLOCKED,
                    Connection::STATUS_REJECTED,
                    Connection::STATUS_PENDING,
                ]),
            ],
        ]);

        $status = $data['status'];
        $isRecipient = $connection->connected_user_id === $user->id;

        if (in_array($status, [Connection::STATUS_ACCEPTED, Connection::STATUS_SNOOZED, Connection::STATUS_REJECTED], true) && ! $isRecipient) {
            return response()->json([
                'message' => 'Only invite recipients can update this state.',
            ], 403);
        }

        if ($status === Connection::STATUS_PENDING && $connection->status !== Connection::STATUS_SNOOZED) {
            return response()->json([
                'message' => 'Pending can only be restored from snoozed invites.',
            ], 422);
        }

        $previous = $connection->status;

        match ($status) {
            Connection::STATUS_ACCEPTED => $connection->accept(),
            Connection::STATUS_SNOOZED => $connection->snooze(),
            Connection::STATUS_BLOCKED => $connection->block(),
            Connection::STATUS_REJECTED => $connection->reject(),
            Connection::STATUS_PENDING => $connection->update(['status' => Connection::STATUS_PENDING]),
            default => null,
        };

        $counterpart = $connection->user_id === $user->id
            ? $connection->connectedUser
            : $connection->user;

        $this->analytics->recordAudit($user, $counterpart, 'connection.status.updated', $connection, [
            'from' => $previous,
            'to' => $connection->status,
        ]);

        return response()->json([
            'connection' => $this->formatConnection($connection->fresh(), $user->id),
        ]);
    }

    public function recommendations(Request $request): JsonResponse
    {
        $user = $request->user();
        $limit = (int) $request->integer('limit', 8);
        $limit = max(3, min(20, $limit));

        $backbone = $this->backbone->build($user);
        $recommendations = $this->insights->connectionRecommendations($user, $limit * 2);
        $userConnections = $this->acceptedConnectionIds($user->id);

        $payload = $recommendations
            ->map(function (array $item) use ($userConnections, $user) {
                $targetId = (int) ($item['id'] ?? 0);
                if ($targetId === 0 || $targetId === $user->id) {
                    return null;
                }

                $mutual = $this->mutualConnectionData($userConnections, $targetId);

                return array_filter([
                    'id' => $targetId,
                    'name' => $item['name'] ?? null,
                    'score' => $item['score'] ?? null,
                    'reason' => $item['reason'] ?? null,
                    'mutual_count' => $mutual['count'],
                    'mutual_connections' => $mutual['connections'],
                    'meta' => $item['meta'] ?? [],
                ], fn ($value) => $value !== null);
            })
            ->filter()
            ->take($limit)
            ->values();

        return response()->json([
            'data' => $payload,
            'meta' => [
                'graph' => [
                    'followers' => Arr::get($backbone, 'graph.followers.stored', 0),
                    'following' => Arr::get($backbone, 'graph.following.stored', 0),
                    'close_friends' => Arr::get($backbone, 'graph.close_friends.count', 0),
                ],
                'generated_at' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * @return ((int|string)[]|bool|int|null|string)[]
     *
     * @psalm-return array{id: int, status: string, initiator_id: int|null, is_initiator: bool, other_user: array{id: int, name: string}|null, updated_at: null|string}
     */
    private function formatConnection(Connection $connection, int $authUserId): array
    {
        $connection->loadMissing(['user:id,name', 'connectedUser:id,name']);
        $isInitiator = $connection->initiator_id === $authUserId;
        $otherUser = $connection->user_id === $authUserId
            ? $connection->connectedUser
            : $connection->user;

        return [
            'id' => $connection->id,
            'status' => $connection->status,
            'initiator_id' => $connection->initiator_id,
            'is_initiator' => $isInitiator,
            'other_user' => $otherUser ? [
                'id' => $otherUser->id,
                'name' => $otherUser->name,
            ] : null,
            'updated_at' => optional($connection->updated_at)?->toIso8601String(),
        ];
    }

    private function resolveTargetUser(User $actor, array $payload): User|null
    {
        $id = $payload['target_user_id'] ?? null;
        $email = $payload['target_email'] ?? null;

        $query = User::query()->where('id', '<>', $actor->id);

        if ($id) {
            return $query->whereKey($id)->first();
        }

        if ($email) {
            return $query->where('email', $email)->first();
        }

        return null;
    }

    private function existingConnection(int $userId, int $targetUserId): Connection|null
    {
        return Connection::query()
            ->where(function ($query) use ($userId, $targetUserId) {
                $query->where('user_id', $userId)
                    ->where('connected_user_id', $targetUserId);
            })
            ->orWhere(function ($query) use ($userId, $targetUserId) {
                $query->where('user_id', $targetUserId)
                    ->where('connected_user_id', $userId);
            })
            ->first();
    }

    private function handleExistingConnection(Connection $connection, User $actor, User $target): ?JsonResponse
    {
        if ($connection->status === Connection::STATUS_ACCEPTED) {
            return response()->json([
                'message' => 'You are already connected.',
                'connection' => $this->formatConnection($connection, $actor->id),
            ]);
        }

        if ($connection->status === Connection::STATUS_PENDING) {
            if ($connection->initiator_id === $actor->id) {
                return response()->json([
                    'message' => 'Your invite is already pending.',
                    'connection' => $this->formatConnection($connection, $actor->id),
                ], 409);
            }

            $connection->accept();
            $this->analytics->recordAudit($actor, $target, 'connection.accepted', $connection, ['source' => 'auto']);

            return response()->json([
                'message' => 'Invite accepted, you are now connected.',
                'connection' => $this->formatConnection($connection->fresh(), $actor->id),
            ]);
        }

        if ($connection->status === Connection::STATUS_SNOOZED) {
            return response()->json([
                'message' => 'This invite is snoozed. Try again after the recipient revisits it.',
            ], 409);
        }

        if ($connection->status === Connection::STATUS_BLOCKED) {
            return response()->json([
                'message' => 'This connection is blocked.',
            ], 409);
        }

        if ($connection->status === Connection::STATUS_REJECTED) {
            $connection->delete();
            return null;
        }

        return response()->json([
            'message' => 'Unable to process this invite.',
        ], 409);
    }

    private function acceptedConnectionIds(int $userId): Collection
    {
        if (array_key_exists($userId, $this->connectionCache)) {
            return $this->connectionCache[$userId];
        }

        $ids = Connection::query()
            ->select('user_id', 'connected_user_id')
            ->where('status', Connection::STATUS_ACCEPTED)
            ->where(function ($query) use ($userId) {
                $query->where('user_id', $userId)
                    ->orWhere('connected_user_id', $userId);
            })
            ->get()
            ->map(function ($connection) use ($userId) {
                return $connection->user_id === $userId
                    ? $connection->connected_user_id
                    : $connection->user_id;
            })
            ->filter()
            ->unique()
            ->values();

        return $this->connectionCache[$userId] = $ids;
    }

    /**
     * @return ((int|string)[][]|int)[]
     *
     * @psalm-return array{count: int, connections: array<int, array{id: int, name: string}>}
     */
    private function mutualConnectionData(Collection $userConnections, int $targetId): array
    {
        $targetConnections = $this->acceptedConnectionIds($targetId);
        $mutualIds = $userConnections->intersect($targetConnections)->values();

        if ($mutualIds->isEmpty()) {
            return ['count' => 0, 'connections' => []];
        }

        $users = User::query()
            ->whereIn('id', $mutualIds->take(6))
            ->get(['id', 'name']);

        return [
            'count' => $mutualIds->count(),
            'connections' => $users->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
            ])->values()->all(),
        ];
    }
}

