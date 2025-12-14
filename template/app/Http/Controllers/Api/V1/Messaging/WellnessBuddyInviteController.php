<?php

namespace App\Http\Controllers\Api\V1\Messaging;

use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\RespondWellnessBuddyInviteRequest;
use App\Http\Requests\Messaging\StoreWellnessBuddyInviteRequest;
use App\Http\Resources\Messaging\ConversationResource;
use App\Http\Resources\Messaging\WellnessBuddyInviteResource;
use App\Models\Profile;
use App\Models\WellnessBuddyInvite;
use App\Services\Messaging\BuddyInviteService;
use App\Support\ActiveProfile;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class WellnessBuddyInviteController extends Controller
{
    public function __construct(private BuddyInviteService $service)
    {
    }

    public function index(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $validated = $request->validate([
            'direction' => ['nullable', Rule::in(['incoming', 'outgoing', 'all'])],
            'status' => ['nullable', Rule::in(['pending', 'accepted', 'declined', 'withdrawn'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $profile = $this->resolveActiveProfile($request);
        $direction = $validated['direction'] ?? 'incoming';
        $status = $validated['status'] ?? null;
        $perPage = (int) ($validated['per_page'] ?? 15);

        $query = WellnessBuddyInvite::query()
            ->with(['requester', 'target']);

        if ($direction === 'outgoing') {
            $query->where('requester_profile_id', $profile->id);
        } elseif ($direction === 'all') {
            $query->where(function ($sub) use ($profile) {
                $sub->where('requester_profile_id', $profile->id)
                    ->orWhere('target_profile_id', $profile->id);
            });
        } else {
            $query->where('target_profile_id', $profile->id);
        }

        if ($status) {
            $query->where('status', $status);
        }

        $invites = $query
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return WellnessBuddyInviteResource::collection($invites);
    }

    public function store(StoreWellnessBuddyInviteRequest $request): \Illuminate\Http\JsonResponse
    {
        $profile = $this->resolveActiveProfile($request);

        if ((int) $request->input('target_profile_id') === $profile->id) {
            throw ValidationException::withMessages([
                'target_profile_id' => ['You cannot invite yourself.'],
            ]);
        }

        $target = Profile::query()->findOrFail($request->input('target_profile_id'));

        $invite = $this->service->sendInvite($profile, $target, $request->validated());

        return (new WellnessBuddyInviteResource($invite->load(['requester', 'target'])))
            ->response()
            ->setStatusCode(201);
    }

    public function respond(RespondWellnessBuddyInviteRequest $request, WellnessBuddyInvite $wellnessBuddyInvite): \Illuminate\Http\JsonResponse
    {
        $profile = $this->resolveActiveProfile($request);
        $invite = $wellnessBuddyInvite->refresh();
        $this->ensureInviteOwnership($invite, $profile);

        $result = $this->service->respond(
            $profile,
            $invite,
            $request->input('action'),
            $request->input('message_body')
        );

        $response = [
            'invite' => (new WellnessBuddyInviteResource($result['invite']))->resolve($request),
        ];

        if ($result['conversation'] ?? null) {
            $response['conversation'] = (new ConversationResource(
                $result['conversation']->load(['participants.profile', 'lastMessage.sender', 'lastMessage.attachments'])
            ))->resolve($request);
        }

        return response()->json($response);
    }

    private function ensureInviteOwnership(WellnessBuddyInvite $invite, Profile $profile): void
    {
        $profileId = (int) $profile->getKey();
        $requesterId = (int) $invite->requester_profile_id;
        $targetId = (int) $invite->target_profile_id;

        if ($requesterId !== $profileId && $targetId !== $profileId) {
            abort(403, 'You do not have access to this invite.');
        }
    }

    private function resolveActiveProfile(Request $request): Profile|null
    {
        $profile = ActiveProfile::forUser($request->user());
        abort_if(!$profile, 403, 'Select a persona before using messaging.');

        return $profile;
    }
}

