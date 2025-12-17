<?php

namespace App\Services\Social;

use App\Models\Candidate;
use App\Models\Connection;
use App\Models\IncidentReport;
use App\Models\SocialBlock;
use App\Models\SocialPost;
use App\Models\SocialPostComment;
use App\Models\SocialPostImpression;
use App\Models\SocialPostReaction;
use App\Models\SocialProfile;
use App\Models\User;
use App\Services\NetworkingAIService;
use App\Services\Privacy\PrivacyTierService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SocialInsightsService
{
    private PrivacyTierService $privacyTiers;

    private NetworkingAIService $networkingAIService;

    public function __construct(?PrivacyTierService $privacyTiers = null, ?NetworkingAIService $networkingAIService = null)
    {
        $this->privacyTiers = $privacyTiers ?? app(PrivacyTierService::class);
        $this->networkingAIService = $networkingAIService ?? app(NetworkingAIService::class);
    }


    /**
     * Retrieve ranked connection recommendations for the authenticated user.
     *
     * @psalm-return Collection<int, array{rank: int,...}>|Collection<never, never>
     */
    public function connectionRecommendations(User $user, int $limit = 10): Collection
    {
        $decision = $this->privacyTiers->guardAnalytics($user, 'social_insights', ['connection_recommendations']);

        if (! in_array('connection_recommendations', $decision['granted'], true)) {
            return collect();
        }

        $limit = max(1, min(50, $limit));
        $recommendations = collect($this->networkingAIService->getConnectionRecommendations($user, $limit))
            ->values();

        $candidateIds = $recommendations
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        if ($candidateIds->isNotEmpty()) {
            $excludedIds = $this->excludedRecommendationUserIds($user, $candidateIds);

            if ($excludedIds->isNotEmpty()) {
                $recommendations = $recommendations
                    ->reject(function (array $item) use ($excludedIds) {
                        return $excludedIds->contains((int) ($item['id'] ?? 0));
                    })
                    ->values();
            }
        }

        return $recommendations
            ->values()
            ->map(function (array $item, int $index) {
                $payload = $this->formatConnectionPayload($item);
                $payload['rank'] = $index + 1;

                return $payload;
            });
    }

    /**
     * Provide a trimmed list of suggested connections for quick display.
     *
     * @psalm-return Collection<int, mixed>
     */
    public function suggestedConnections(User $user, int $limit = 5): Collection
    {
        $limit = max(1, min(25, $limit));

        return $this->connectionRecommendations($user, $limit)->take($limit)->values();
    }

    /**
     * Provide grouped connection candidates by mutual signals.
     *
     * @return (((array|string)[]|int|null|string)[]|bool)[]
     *
     * @psalm-return array{clusters: array<int, array{key: 'industry_insiders'|'mutual_connections'|'shared_skills', label: string, members: array<int, mixed>}|null>, meta: array{source: 'networking_ai', total_candidates: int}, fallback: bool}
     */
    public function networkClusters(User $user, int $limit = 5): array
    {
        $decision = $this->privacyTiers->guardAnalytics($user, 'social_insights', ['network_clusters']);

        if (! in_array('network_clusters', $decision['granted'], true)) {
            return [
                'clusters' => [],
                'meta' => ['source' => 'networking_ai', 'total_candidates' => 0],
                'fallback' => true,
            ];
        }

        $recommendations = $this->connectionRecommendations($user, $limit * 3);

        if ($recommendations->isEmpty()) {
            return [
                'clusters' => [],
                'meta' => ['source' => 'networking_ai', 'total_candidates' => 0],
                'fallback' => true,
            ];
        }

        $clusters = [
            'shared_skills' => [],
            'mutual_connections' => [],
            'industry_insiders' => [],
        ];

        foreach ($recommendations as $candidate) {
            $meta = $candidate['meta'] ?? [];
            $reason = Str::of((string) ($candidate['reason'] ?? ''))->lower();
            $bucket = null;

            if ($reason->contains('skill') || ($meta['experience_id'] ?? null)) {
                $bucket = 'shared_skills';
            } elseif ($reason->contains('mutual') || ($meta['connections'] ?? null) > 0) {
                $bucket = 'mutual_connections';
            } elseif ($reason->contains('industry') || ($meta['profession_id'] ?? null)) {
                $bucket = 'industry_insiders';
            }

            if ($bucket === null) {
                $bucket = 'mutual_connections';
            }

            $clusters[$bucket][] = $candidate;
        }

        $payload = collect($clusters)
            ->map(function (array $items, string $key) use ($limit) {
                if (empty($items)) {
                    return null;
                }

                return [
                    'key' => $key,
                    'label' => match ($key) {
                        'shared_skills' => 'Shared Skills',
                        'mutual_connections' => 'Mutual Connections',
                        'industry_insiders' => 'Industry Insiders',
                        default => Str::headline($key),
                    },
                    'members' => collect($items)
                        ->sortByDesc(fn ($item) => $item['score'] ?? 0)
                        ->take($limit)
                        ->values()
                        ->all(),
                ];
            })
            ->filter()
            ->values()
            ->all();

        return [
            'clusters' => $payload,
            'meta' => [
                'source' => 'networking_ai',
                'total_candidates' => $recommendations->count(),
            ],
            'fallback' => false,
        ];
    }

    /**
     * Summarise connection activity and key next steps.
     */
    public function connectionPulse(User $user): array
    {
        $decision = $this->privacyTiers->guardAnalytics($user, 'social_insights', ['trend_metrics', 'connection_names']);
        $allowTrends = in_array('trend_metrics', $decision['granted'], true);
        $allowNames = in_array('connection_names', $decision['granted'], true);

        if (! $allowTrends) {
            return $this->emptyConnectionPulse();
        }

        $connections = $this->getUserConnections($user);

        if ($connections->isEmpty()) {
            return $this->emptyConnectionPulse();
        }

        $acceptedConnections = $connections->where('status', 'accepted');
        [$pendingIncomingConnections, $pendingOutgoingConnections] = $this->splitPendingConnections($connections, $user);

        $now = Carbon::now();
        $trend = $this->calculateTrend($acceptedConnections, $now);
        $summary = $this->buildPulseSummary($acceptedConnections, $pendingIncomingConnections, $pendingOutgoingConnections, $trend);
        $acceptanceRate = $this->calculateAcceptanceRate($connections, $user);
        $topRole = $this->determineTopRole($acceptedConnections, $user);

        $insights = $this->buildPulseInsights(
            $topRole,
            $trend,
            $summary['pending_incoming'],
            $summary['pending_outgoing']
        );

        $followUp = $this->buildPulseFollowUp($pendingIncomingConnections, $pendingOutgoingConnections, $allowNames);

        return [
            'summary' => $summary,
            'acceptance_rate' => $acceptanceRate,
            'trend' => [
                'direction' => $trend['direction'],
                'change' => $trend['change'],
                'percent' => $trend['percent'],
            ],
            'insights' => $insights,
            'follow_up' => $followUp,
            'fallback' => false,
        ];
    }

    /**
     * @psalm-return \Illuminate\Database\Eloquent\Collection<int, Connection>
     */
    private function getUserConnections(User $user): \Illuminate\Database\Eloquent\Collection
    {
        return Connection::query()
            ->where(function ($query) use ($user) {
                $query->where('user_id', $user->id)
                    ->orWhere('connected_user_id', $user->id);
            })
            ->get(['id', 'user_id', 'connected_user_id', 'status', 'type', 'created_at', 'updated_at']);
    }

    /**
     * @return ((array|int|null|string)[]|null|true)[]
     *
     * @psalm-return array{summary: array{total_connections: 0, pending_incoming: 0, pending_outgoing: 0, new_connections_30_days: 0}, acceptance_rate: null, trend: array{direction: 'stable', change: 0, percent: null}, insights: list{'Grow your network by acting on AI recommendations.'}, follow_up: array{incoming: array<never, never>, outgoing: array<never, never>}, fallback: true}
     */
    private function emptyConnectionPulse(): array
    {
        return [
            'summary' => [
                'total_connections' => 0,
                'pending_incoming' => 0,
                'pending_outgoing' => 0,
                'new_connections_30_days' => 0,
            ],
            'acceptance_rate' => null,
            'trend' => [
                'direction' => 'stable',
                'change' => 0,
                'percent' => null,
            ],
            'insights' => ['Grow your network by acting on AI recommendations.'],
            'follow_up' => [
                'incoming' => [],
                'outgoing' => [],
            ],
            'fallback' => true,
        ];
    }

    /**
     * @return Collection[]
     *
     * @psalm-return list{Collection, Collection}
     */
    private function splitPendingConnections(Collection $connections, User $user): array
    {
        $pendingIncoming = $connections->filter(fn ($item) => $item->status === 'pending' && $item->connected_user_id === $user->id);
        $pendingOutgoing = $connections->filter(fn ($item) => $item->status === 'pending' && $item->user_id === $user->id);

        return [$pendingIncoming, $pendingOutgoing];
    }

    /**
     * @return (float|int|null|string)[]
     *
     * @psalm-return array{new_connections: int, previous_connections: int<min, max>, change: int<min, max>, direction: 'declining'|'rising'|'stable', percent: float|null}
     */
    private function calculateTrend(Collection $acceptedConnections, Carbon $now): array
    {
        $windowStart = $now->copy()->subDays(30);
        $previousWindowStart = $now->copy()->subDays(60);

        $newConnections = $acceptedConnections
            ->filter(fn ($item) => $item->updated_at && $item->updated_at->greaterThanOrEqualTo($windowStart))
            ->count();

        $previousConnections = $acceptedConnections
            ->filter(fn ($item) => $item->updated_at
                && $item->updated_at->lessThan($windowStart)
                && $item->updated_at->greaterThanOrEqualTo($previousWindowStart))
            ->count();

        $change = $newConnections - $previousConnections;
        $direction = 'stable';
        if ($change > 1) {
            $direction = 'rising';
        } elseif ($change < -1) {
            $direction = 'declining';
        }

        $percent = $previousConnections > 0
            ? round(($change / $previousConnections) * 100, 1)
            : ($newConnections > 0 ? 100.0 : null);

        return [
            'new_connections' => $newConnections,
            'previous_connections' => $previousConnections,
            'change' => $change,
            'direction' => $direction,
            'percent' => $percent,
        ];
    }

    /**
     * @return (int|mixed)[]
     *
     * @psalm-return array{total_connections: int, pending_incoming: int, pending_outgoing: int, new_connections_30_days: mixed}
     */
    private function buildPulseSummary(
        Collection $acceptedConnections,
        Collection $pendingIncoming,
        Collection $pendingOutgoing,
        array $trend
    ): array {
        return [
            'total_connections' => $acceptedConnections->count(),
            'pending_incoming' => $pendingIncoming->count(),
            'pending_outgoing' => $pendingOutgoing->count(),
            'new_connections_30_days' => $trend['new_connections'],
        ];
    }

    private function calculateAcceptanceRate(Collection $connections, User $user): ?float
    {
        $decisionScope = $connections->filter(fn ($item) => in_array($item->status, ['accepted', 'rejected'], true)
            && $item->user_id === $user->id);
        $decisionCount = $decisionScope->count();

        if ($decisionCount === 0) {
            return null;
        }

        $acceptedByUser = $decisionScope->where('status', 'accepted')->count();

        return round(($acceptedByUser / $decisionCount) * 100, 1);
    }

    private function determineTopRole(Collection $acceptedConnections, User $user): ?string
    {
        $counterpartIds = $acceptedConnections
            ->map(fn ($connection) => $connection->user_id === $user->id
                ? $connection->connected_user_id
                : $connection->user_id)
            ->filter()
            ->unique()
            ->values();

        if ($counterpartIds->isEmpty()) {
            return null;
        }

        $titles = Candidate::query()
            ->whereIn('user_id', $counterpartIds)
            ->pluck('title');

        return $titles
            ->filter()
            ->groupBy(fn ($title) => Str::lower($title))
            ->sortByDesc(fn ($group) => $group->count())
            ->keys()
            ->map(fn ($title) => Str::title($title))
            ->first();
    }

    /**
     * @return string[]
     *
     * @psalm-return non-empty-list<non-empty-string>
     */
    private function buildPulseInsights(
        ?string $topRole,
        array $trend,
        int $pendingIncoming,
        int $pendingOutgoing
    ): array {
        $insights = [];

        if ($topRole) {
            $insights[] = "Most of your connections reference {$topRole} roles.";
        }

        if ($trend['direction'] === 'rising' && $trend['change'] > 0) {
            $count = $trend['new_connections'];
            $insights[] = "You've added {$count} new connection" . ($count === 1 ? '' : 's') . ' in the last month.';
        }

        if (($pendingIncoming + $pendingOutgoing) > 0) {
            $insights[] = 'You have connection requests waiting for a response.';
        }

        if (empty($insights)) {
            $insights[] = 'Keep momentum by nurturing three connections this week.';
        }

        return array_values(array_unique($insights));
    }

    /**
     * @return (int|mixed|string)[][][]
     *
     * @psalm-return array{incoming: array<int, array{id: int|mixed, name?: string}>, outgoing: array<int, array{id: int|mixed, name?: string}>}
     */
    private function buildPulseFollowUp(
        Collection $pendingIncomingConnections,
        Collection $pendingOutgoingConnections,
        bool $includeNames = true
    ): array {
        if (! $includeNames) {
            return [
                'incoming' => $pendingIncomingConnections
                    ->pluck('user_id')
                    ->unique()
                    ->values()
                    ->map(fn ($id) => ['id' => $id])
                    ->all(),
                'outgoing' => $pendingOutgoingConnections
                    ->pluck('connected_user_id')
                    ->unique()
                    ->values()
                    ->map(fn ($id) => ['id' => $id])
                    ->all(),
            ];
        }

        $incomingUsers = User::query()
            ->whereIn('id', $pendingIncomingConnections->pluck('user_id')->unique()->values())
            ->get(['id', 'name']);

        $outgoingUsers = User::query()
            ->whereIn('id', $pendingOutgoingConnections->pluck('connected_user_id')->unique()->values())
            ->get(['id', 'name']);

        return [
            'incoming' => $incomingUsers->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
            ])->values()->all(),
            'outgoing' => $outgoingUsers->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
            ])->values()->all(),
        ];
    }

    /**
     * @psalm-return Collection<int, mixed>
     */
    protected function excludedRecommendationUserIds(User $user, Collection $candidateIds): Collection
    {
        return $this->blockedUserIds($user, $candidateIds)
            ->merge($this->flaggedUserIds($candidateIds))
            ->unique()
            ->values();
    }

    protected function blockedUserIds(User $user, Collection $candidateIds): Collection
    {
        $profileIds = SocialProfile::query()
            ->where('user_id', $user->id)
            ->pluck('id')
            ->filter();

        if ($profileIds->isEmpty()) {
            return collect();
        }

        $blockedProfiles = SocialBlock::query()
            ->active()
            ->whereIn('blocker_profile_id', $profileIds)
            ->pluck('blocked_profile_id');

        $blockingProfiles = SocialBlock::query()
            ->active()
            ->whereIn('blocked_profile_id', $profileIds)
            ->pluck('blocker_profile_id');

        $profileSet = $blockedProfiles->merge($blockingProfiles)->unique()->filter();

        if ($profileSet->isEmpty()) {
            return collect();
        }

        return SocialProfile::query()
            ->whereIn('id', $profileSet)
            ->when($candidateIds->isNotEmpty(), fn ($query) => $query->whereIn('user_id', $candidateIds))
            ->pluck('user_id')
            ->filter(fn ($id) => $id !== null)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();
    }

    /**
     * @psalm-return Collection<int, int>|Collection<never, never>
     */
    protected function flaggedUserIds(Collection $candidateIds): Collection
    {
        if ($candidateIds->isEmpty()) {
            return collect();
        }

        return IncidentReport::query()
            ->whereIn('subject_user_id', $candidateIds)
            ->where(function ($query) {
                $query->whereNull('resolved_at')
                    ->orWhereNotIn('status', ['resolved', 'closed', 'dismissed']);
            })
            ->pluck('subject_user_id')
            ->filter(fn ($id) => $id !== null)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();
    }

    /**
     * Provide a rolling weekly summary of new connections.
     *
     * @return (((float|int|mixed|null|string)[]|float|int|null|string)[]|bool)[]
     *
     * @psalm-return array{series: list{0?: array{week_start: string, week_label: string, new_connections: int, week_end: string},...}, summary: array{total_new_connections: int, average_per_week: 0|float, best_week: array{week_start: string, week_label: string, new_connections: int, week_end: string}|null, pending_requests: int, momentum: array{direction: string, change: 0|mixed, percent: float|null}}, insights: list{0?: string,...}, fallback: bool}
     */
    public function connectionMomentum(User $user, int $weeks = 6): array
    {
        $decision = $this->privacyTiers->guardAnalytics($user, 'social_insights', ['trend_metrics']);

        if (! in_array('trend_metrics', $decision['granted'], true)) {
            return [
                'series' => [],
                'summary' => [
                    'total_new_connections' => 0,
                    'average_per_week' => 0,
                    'best_week' => null,
                    'pending_requests' => 0,
                    'momentum' => [
                        'direction' => 'blocked',
                        'change' => 0,
                        'percent' => null,
                    ],
                ],
                'insights' => ['Connection insights are limited while privacy wizard is set to invite-only.'],
                'fallback' => true,
            ];
        }

        $weeks = max(2, min(12, $weeks));

        $rangeEnd = Carbon::now()->endOfWeek();
        $rangeStart = $rangeEnd->copy()->subWeeks($weeks - 1)->startOfWeek();

        $acceptedConnections = Connection::query()
            ->where(function ($query) use ($user) {
                $query->where('user_id', $user->id)
                    ->orWhere('connected_user_id', $user->id);
            })
            ->where('status', 'accepted')
            ->whereBetween('updated_at', [$rangeStart, $rangeEnd])
            ->get(['id', 'updated_at', 'created_at']);

        $pendingCount = Connection::query()
            ->where(function ($query) use ($user) {
                $query->where('user_id', $user->id)
                    ->orWhere('connected_user_id', $user->id);
            })
            ->where('status', 'pending')
            ->count();

        $bucketed = $acceptedConnections->groupBy(function ($connection) use ($rangeStart) {
            $timestamp = $connection->updated_at ?? $connection->created_at ?? $rangeStart;
            return $timestamp->copy()->startOfWeek()->toDateString();
        });

        $series = [];
        for ($i = 0; $i < $weeks; $i++) {
            $weekStart = $rangeStart->copy()->addWeeks($i);
            $key = $weekStart->toDateString();
            $bucket = $bucketed->get($key);
            $count = $bucket instanceof Collection ? $bucket->count() : 0;

            $series[] = [
                'week_start' => $key,
                'week_label' => $weekStart->format('M j'),
                'new_connections' => $count,
                'week_end' => $weekStart->copy()->endOfWeek()->toDateString(),
            ];
        }

        $totalNew = array_sum(array_column($series, 'new_connections'));

        if ($totalNew === 0) {
            return [
                'series' => $series,
                'summary' => [
                    'total_new_connections' => 0,
                    'average_per_week' => 0,
                    'best_week' => null,
                    'pending_requests' => $pendingCount,
                    'momentum' => [
                        'direction' => 'stable',
                        'change' => 0,
                        'percent' => null,
                    ],
                ],
                'insights' => ['No recent connection approvals. Act on pending requests or send new invites.'],
                'fallback' => true,
            ];
        }

        $average = round($totalNew / $weeks, 1);

        $bestWeek = collect($series)
            ->sort(function (array $a, array $b) {
                if ($a['new_connections'] === $b['new_connections']) {
                    return strcmp($b['week_start'], $a['week_start']);
                }

                return $b['new_connections'] <=> $a['new_connections'];
            })
            ->first();

        $latest = $series[count($series) - 1]['new_connections'] ?? 0;
        $previous = $series[count($series) - 2]['new_connections'] ?? 0;
        $momentumChange = $latest - $previous;

        $momentumDirection = 'stable';
        if ($momentumChange > 0) {
            $momentumDirection = 'rising';
        } elseif ($momentumChange < 0) {
            $momentumDirection = 'declining';
        }

        $momentumPercent = $previous > 0
            ? round(($momentumChange / $previous) * 100, 1)
            : ($latest > 0 ? 100.0 : null);

        $insights = [];
        if ($latest > 0) {
            $insights[] = "You added {$latest} new connection" . ($latest === 1 ? '' : 's') . ' this week.';
        }

        if ($momentumDirection === 'rising' && $momentumChange > 0) {
            $insights[] = "Momentum is up by {$momentumChange} connection" . ($momentumChange === 1 ? '' : 's') . ' versus last week.';
        } elseif ($momentumDirection === 'declining' && $momentumChange < 0) {
            $insights[] = 'Connection momentum dipped this week — follow up on pending requests to stay visible.';
        }

        if ($bestWeek && $bestWeek['new_connections'] > 0) {
            $bestWeekLabel = Carbon::parse($bestWeek['week_start'])->format('M j');
            $insights[] = "Your strongest week started {$bestWeekLabel} with {$bestWeek['new_connections']} new connection" . ($bestWeek['new_connections'] === 1 ? '' : 's') . '.';
        }

        if ($average >= 1) {
            $insights[] = "Averaging {$average} new connection" . ($average === 1.0 ? '' : 's') . " per week over the last {$weeks} weeks.";
        }

        $insights = array_values(array_unique($insights));

        return [
            'series' => $series,
            'summary' => [
                'total_new_connections' => $totalNew,
                'average_per_week' => $average,
                'best_week' => $bestWeek,
                'pending_requests' => $pendingCount,
                'momentum' => [
                    'direction' => $momentumDirection,
                    'change' => $momentumChange,
                    'percent' => $momentumPercent,
                ],
            ],
            'insights' => $insights,
            'fallback' => false,
        ];
    }

    /**
     * Summarise connection statuses for visual breakdowns.
     *
     * @return (array|bool|int|null|string)[]
     *
     * @psalm-return array{total: int, statuses: list<array{count: int, label: string, percent: float, status: non-falsy-string}>, pending_breakdown: array{incoming: int, outgoing: int}, pending_recency: array, stale_pending: array{incoming: array, outgoing: array, total: int<0, max>}, dominant_status: array{status: string, label: string, count: int, percent: float}|null, updated_at: string, fallback: bool}
     */
    public function connectionStatusBreakdown(User $user): array
    {
        $connections = Connection::query()
            ->where(function ($query) use ($user) {
                $query->where('user_id', $user->id)
                    ->orWhere('connected_user_id', $user->id);
            })
            ->get(['id', 'user_id', 'connected_user_id', 'status', 'created_at', 'updated_at']);

        $now = Carbon::now();
        $staleThreshold = 7;
        $pendingRecency = $this->defaultPendingRecency($staleThreshold);
        $stalePending = [
            'incoming' => [],
            'outgoing' => [],
            'total' => 0,
        ];

        if ($connections->isEmpty()) {
            return [
                'total' => 0,
                'statuses' => [],
                'pending_breakdown' => [
                    'incoming' => 0,
                    'outgoing' => 0,
                ],
                'pending_recency' => $pendingRecency,
                'stale_pending' => $stalePending,
                'dominant_status' => null,
                'updated_at' => $now->toIso8601String(),
                'fallback' => true,
            ];
        }

        $total = $connections->count();

    $pendingIncomingConnections = $connections->filter(fn ($item) => $item->status === 'pending' && $item->connected_user_id === $user->id);
    $pendingOutgoingConnections = $connections->filter(fn ($item) => $item->status === 'pending' && $item->user_id === $user->id);
    $pendingOverall = $connections->filter(fn ($item) => $item->status === 'pending');

    $pendingIncoming = $pendingIncomingConnections->count();
    $pendingOutgoing = $pendingOutgoingConnections->count();

        $pendingRecency['incoming'] = $this->pendingTimingMetrics($pendingIncomingConnections, $now, $staleThreshold);
        $pendingRecency['outgoing'] = $this->pendingTimingMetrics($pendingOutgoingConnections, $now, $staleThreshold);
        $pendingRecency['overall'] = $this->pendingTimingMetrics($pendingOverall, $now, $staleThreshold);

    $stalePending['incoming'] = $this->stalePendingEntries($pendingIncomingConnections, $now, $staleThreshold, true);
    $stalePending['outgoing'] = $this->stalePendingEntries($pendingOutgoingConnections, $now, $staleThreshold, false);
    $stalePending['total'] = count($stalePending['incoming']) + count($stalePending['outgoing']);

        $statusCounts = $connections->groupBy(function ($connection) {
            $status = Str::of((string) $connection->status)->lower()->value();

            return $status ?: 'unknown';
        })->map(function (Collection $group) {
            return $group->count();
        })->toArray();

        $labels = [
            'accepted' => 'Accepted',
            'pending' => 'Pending',
            'rejected' => 'Declined',
            'blocked' => 'Blocked',
            'cancelled' => 'Cancelled',
            'unknown' => 'Unknown',
        ];

        $payloadStatuses = [];

        foreach ($labels as $key => $label) {
            $count = (int) ($statusCounts[$key] ?? 0);
            if ($count === 0) {
                continue;
            }

            $payloadStatuses[] = [
                'status' => $key,
                'label' => $label,
                'count' => $count,
                'percent' => round(($count / $total) * 100, 1),
            ];

            unset($statusCounts[$key]);
        }

        foreach ($statusCounts as $key => $count) {
            $payloadStatuses[] = [
                'status' => $key,
                'label' => Str::headline($key),
                'count' => (int) $count,
                'percent' => round(($count / $total) * 100, 1),
            ];
        }

        if (empty($payloadStatuses)) {
            return [
                'total' => 0,
                'statuses' => [],
                'pending_breakdown' => [
                    'incoming' => $pendingIncoming,
                    'outgoing' => $pendingOutgoing,
                ],
                'pending_recency' => $pendingRecency,
                'stale_pending' => $stalePending,
                'dominant_status' => null,
                'updated_at' => $now->toIso8601String(),
                'fallback' => true,
            ];
        }

        usort($payloadStatuses, function ($a, $b) {
            if ($a['count'] === $b['count']) {
                return strcmp($a['label'], $b['label']);
            }

            return $b['count'] <=> $a['count'];
        });

        $dominant = $payloadStatuses[0];

        return [
            'total' => $total,
            'statuses' => array_map(function (array $item) {
                $item['percent'] = min(100.0, $item['percent']);

                return $item;
            }, $payloadStatuses),
            'pending_breakdown' => [
                'incoming' => $pendingIncoming,
                'outgoing' => $pendingOutgoing,
            ],
            'pending_recency' => $pendingRecency,
            'stale_pending' => $stalePending,
            'dominant_status' => $dominant,
            'updated_at' => $now->toIso8601String(),
            'fallback' => false,
        ];
    }

    /**
     * @return (float|int|null)[]
     *
     * @psalm-return array{average_days: float|null, oldest_days: int|null, stale_count: int}
     */
    private function pendingTimingMetrics(Collection $connections, Carbon $now, int $staleThreshold): array
    {
        if ($connections->isEmpty()) {
            return [
                'average_days' => null,
                'oldest_days' => null,
                'stale_count' => 0,
            ];
        }

        $ages = $connections->map(function ($connection) use ($now) {
            $timestamp = $connection->updated_at ?? $connection->created_at ?? $now;

            if (! $timestamp instanceof Carbon) {
                $timestamp = Carbon::parse($timestamp);
            }

            return max(0, $timestamp->diffInDays($now));
        });

        return [
            'average_days' => round($ages->avg(), 1),
            'oldest_days' => (int) $ages->max(),
            'stale_count' => $ages->filter(fn ($days) => $days >= $staleThreshold)->count(),
        ];
    }

    /**
     * @return ((int|null)[]|int)[]
     *
     * @psalm-return array{incoming: array{average_days: null, oldest_days: null, stale_count: 0}, outgoing: array{average_days: null, oldest_days: null, stale_count: 0}, overall: array{average_days: null, oldest_days: null, stale_count: 0}, stale_threshold_days: int}
     */
    private function defaultPendingRecency(int $staleThreshold): array
    {
        return [
            'incoming' => [
                'average_days' => null,
                'oldest_days' => null,
                'stale_count' => 0,
            ],
            'outgoing' => [
                'average_days' => null,
                'oldest_days' => null,
                'stale_count' => 0,
            ],
            'overall' => [
                'average_days' => null,
                'oldest_days' => null,
                'stale_count' => 0,
            ],
            'stale_threshold_days' => $staleThreshold,
        ];
    }

    /**
     * @return (int|mixed|string)[][]
     *
     * @psalm-return array<int, array{connection_id: mixed, user_id: mixed, name: string, days_waiting: int, direction: 'incoming'|'outgoing'}>
     */
    private function stalePendingEntries(Collection $connections, Carbon $now, int $staleThreshold, bool $incoming): array
    {
        if ($connections->isEmpty()) {
            return [];
        }

        $stale = $connections->filter(function ($connection) use ($now, $staleThreshold) {
            $timestamp = $connection->updated_at ?? $connection->created_at ?? $now;

            if (! $timestamp instanceof Carbon) {
                $timestamp = Carbon::parse($timestamp);
            }

            return $timestamp->diffInDays($now) >= $staleThreshold;
        });

        if ($stale->isEmpty()) {
            return [];
        }

        $counterpartKey = $incoming ? 'user_id' : 'connected_user_id';

        $userIds = $stale
            ->map(fn ($connection) => $connection->{$counterpartKey})
            ->filter()
            ->unique()
            ->values();

        $users = User::query()
            ->whereIn('id', $userIds)
            ->get(['id', 'name'])
            ->keyBy('id');

        return $stale
            ->map(function ($connection) use ($users, $now, $counterpartKey, $incoming) {
                $timestamp = $connection->updated_at ?? $connection->created_at ?? $now;

                if (! $timestamp instanceof Carbon) {
                    $timestamp = Carbon::parse($timestamp);
                }

                $waitingDays = $timestamp->diffInDays($now);
                $userId = $connection->{$counterpartKey};
                $name = $users->get($userId)?->name ?? 'Connection';

                return [
                    'connection_id' => $connection->id,
                    'user_id' => $userId,
                    'name' => $name,
                    'days_waiting' => (int) $waitingDays,
                    'direction' => $incoming ? 'incoming' : 'outgoing',
                ];
            })
            ->sortByDesc('days_waiting')
            ->values()
            ->all();
    }

    /**
     * Derive a profile strength score with component breakdowns.
     *
     * @return ((array|int|mixed|null|string)[]|bool|int)[]
     *
     * @psalm-return array{strength: int, components: list{0?: array, 1?: array, 2?: array, 3?: array, 4?: array, 5?: array}, recommendations: list{0?: string,...}, meta: array{skills_count: int<min, max>, experience_records: int<min, max>, trust_score: mixed|null}, fallback: bool}
     */
    public function profileStrength(User $user, ?Candidate $candidate = null, ?SocialProfile $socialProfile = null): array
    {
        $candidate ??= $this->resolveCandidate($user);
        $socialProfile ??= $this->resolveSocialProfile($user);

        if (! $candidate) {
            return [
                'strength' => 35,
                'components' => [],
                'recommendations' => ['Add your work history and skills to unlock personalised guidance.'],
                'meta' => ['skills_count' => 0, 'experience_records' => 0, 'trust_score' => $socialProfile?->trust_score],
                'fallback' => true,
            ];
        }

        $components = [];
        $recommendations = [];
        $score = 35.0;

        // Professional summary / bio
        if ($candidate->bio) {
            $components[] = $this->componentPayload('Professional summary', 12, 'complete', 'Profile biography present.');
            $score += 12;
        } else {
            $components[] = $this->componentPayload('Professional summary', 0, 'missing', 'Add a short bio to highlight your value.');
            $recommendations[] = 'Add a concise professional summary highlighting recent wins.';
        }

        // Profile photo
        if ($candidate->image) {
            $components[] = $this->componentPayload('Profile photo', 10, 'complete', 'Professional image uploaded.');
            $score += 10;
        } else {
            $components[] = $this->componentPayload('Profile photo', 0, 'missing', 'Upload a professional profile photo.');
            $recommendations[] = 'Upload a current profile photo to build trust with employers.';
        }

        // CV or portfolio asset
        if ($candidate->cv) {
            $components[] = $this->componentPayload('Resume / portfolio', 12, 'complete', 'Resume linked.');
            $score += 12;
        } else {
            $components[] = $this->componentPayload('Resume / portfolio', 0, 'missing', 'Attach a resume to unlock personalised job matches.');
            $recommendations[] = 'Attach a resume or portfolio link so recruiters can review your work quickly.';
        }

        // Experience records
        $experienceCount = $candidate->experiences?->count() ?? 0;
        if ($experienceCount > 0) {
            $experienceScore = min(15, 5 + ($experienceCount * 2.5));
            $components[] = $this->componentPayload('Experience history', (int) round($experienceScore), 'complete', 'Experience records added.');
            $score += $experienceScore;
        } else {
            $components[] = $this->componentPayload('Experience history', 0, 'missing', 'Add your previous roles and accomplishments.');
            $recommendations[] = 'Add at least one recent role with key achievements to strengthen credibility.';
        }

        // Skills coverage
        $skillsCount = $candidate->skills?->count() ?? 0;
        if ($skillsCount >= 5) {
            $skillScore = min(12, 6 + ($skillsCount * 0.8));
            $components[] = $this->componentPayload('Skill coverage', (int) round($skillScore), 'complete', 'Skills catalogue populated.');
            $score += $skillScore;
        } elseif ($skillsCount > 0) {
            $skillScore = min(8, 4 + ($skillsCount * 0.8));
            $components[] = $this->componentPayload('Skill coverage', (int) round($skillScore), 'partial', 'Some skills captured.');
            $score += $skillScore;
            $recommendations[] = 'List at least five core skills to improve discoverability.';
        } else {
            $components[] = $this->componentPayload('Skill coverage', 0, 'missing', 'No skills listed.');
            $recommendations[] = 'Add your top technical and leadership skills to surface in relevant searches.';
        }

        // Social trust & activity
        if ($socialProfile) {
            $trustBoost = min(18, max(0, (int) floor($socialProfile->trust_score / 6)));
            $engagementBoost = min(8, max(0, (int) floor($socialProfile->engagement_score / 10)));
            $components[] = $this->componentPayload('Network trust', $trustBoost + $engagementBoost, 'complete', 'Social presence connected.');
            $score += $trustBoost + $engagementBoost;
        } else {
            $components[] = $this->componentPayload('Network trust', 0, 'missing', 'Connect a social profile to measure trust.');
            $recommendations[] = 'Connect your social profile to showcase reputation and engagement.';
        }

        $strength = (int) round(min(100, $score));

        return [
            'strength' => $strength,
            'components' => $components,
            'recommendations' => array_values(array_unique($recommendations)),
            'meta' => [
                'skills_count' => $skillsCount,
                'experience_records' => $experienceCount,
                'trust_score' => $socialProfile?->trust_score,
            ],
            'fallback' => false,
        ];
    }

    /**
     * Estimate job match readiness using profile strength and trust signals.
     *
     * @return ((mixed|null|string)[]|bool|int|string)[]
     *
     * @psalm-return array{score: int<min, max>, confidence: 'high'|'low'|'medium', signals: list<'Availability set to actively looking.'|'Profession selected for targeted recommendations.'|'Rich experience history boosts employer confidence.'|'Social trust and engagement improve match ranking.'>, recommendations: list{0?: string,...}, meta: array{profile_strength: mixed, trust_score?: mixed|null}, fallback: bool}
     */
    public function jobMatch(User $user): array
    {
        $candidate = $this->resolveCandidate($user);
        $socialProfile = $this->resolveSocialProfile($user);
        $profileInsights = $this->profileStrength($user, $candidate, $socialProfile);

        if ($profileInsights['fallback']) {
            return [
                'score' => 40,
                'confidence' => 'low',
                'signals' => [],
                'recommendations' => ['Complete your candidate profile to unlock AI job matching.'],
                'meta' => ['profile_strength' => $profileInsights['strength']],
                'fallback' => true,
            ];
        }

    $score = (int) round($profileInsights['strength'] * 0.55) + 8;
        $signals = [];
        $recommendations = [];

        if ($candidate?->status === 'available') {
            $score += 8;
            $signals[] = 'Availability set to actively looking.';
        } else {
            $recommendations[] = 'Toggle your availability to signal that you are open to opportunities.';
        }

        $experienceRecords = $candidate?->experiences?->count() ?? 0;
        if ($experienceRecords >= 3) {
            $score += 8;
            $signals[] = 'Rich experience history boosts employer confidence.';
        } elseif ($experienceRecords === 0) {
            $recommendations[] = 'Add recent experience entries to improve match quality.';
        }

        if ($candidate?->profession_id) {
            $score += 6;
            $signals[] = 'Profession selected for targeted recommendations.';
        } else {
            $recommendations[] = 'Select a primary profession to tailor job matches.';
        }

        if ($socialProfile) {
            $trustContribution = min(15, max(0, (int) floor($socialProfile->trust_score / 5)));
            $engagementContribution = min(10, max(0, (int) floor($socialProfile->engagement_score / 8)));
            $score += $trustContribution + $engagementContribution;
            $signals[] = 'Social trust and engagement improve match ranking.';
        } else {
            $recommendations[] = 'Connect a social profile to highlight your network credibility.';
        }

    $score = (int) round(min(100, max(0, $score)));
    $confidence = $score >= 70 ? 'high' : ($score >= 55 ? 'medium' : 'low');

        return [
            'score' => $score,
            'confidence' => $confidence,
            'signals' => array_values(array_unique($signals)),
            'recommendations' => array_values(array_unique($recommendations)),
            'meta' => [
                'profile_strength' => $profileInsights['strength'],
                'trust_score' => $socialProfile?->trust_score,
            ],
            'fallback' => false,
        ];
    }

    /**
     * Calculate the optimal posting hour based on historical impressions.
     *
     * @return scalar[]
     *
     * @psalm-return array{hour: int, label: string, confidence: float, samples: int, fallback: bool}
     */
    public function bestPostingTime(User $user): array
    {
        $impressions = SocialPostImpression::query()
            ->whereHas('post', fn ($query) => $query->where('user_id', $user->id))
            ->whereNotNull('viewed_at')
            ->get(['viewed_at']);

        if ($impressions->isEmpty()) {
            $defaultHour = 10;

            return [
                'hour' => $defaultHour,
                'label' => Carbon::createFromTime($defaultHour)->format('g A'),
                'confidence' => 35.0,
                'samples' => 0,
                'fallback' => true,
            ];
        }

        $grouped = $impressions->groupBy(fn ($impression) => $impression->viewed_at->format('H'));
        $total = $impressions->count();

        $topHour = $grouped
            ->map(fn ($items) => $items->count())
            ->sortDesc()
            ->keys()
            ->first();

        $topCount = $grouped[$topHour]->count();
        $hour = (int) $topHour;

        return [
            'hour' => $hour,
            'label' => Carbon::createFromTime($hour)->format('g A'),
            'confidence' => round(($topCount / max(1, $total)) * 100, 1),
            'samples' => $total,
            'fallback' => false,
        ];
    }

    /**
     * Summarise social post performance metrics for the authenticated user.
     *
     * @return ((float|int|string)[]|null)[]
     *
     * @psalm-return array{posts: array{total: int, last_30_days: int}, engagement: array{reactions: int, comments: int, impressions: int}, top_post: array{id: int, score: int, published_at: string}|null, trends: array{avg_engagement_per_post: float, engagement_rate: float}}
     */
    public function analyticsSummary(User $user): array
    {
        $postQuery = SocialPost::query()->where('user_id', $user->id);
        $totalPosts = (clone $postQuery)->count();

        $windowStart = Carbon::now()->subDays(30);
        $recentPosts = (clone $postQuery)
            ->where(function ($query) use ($windowStart) {
                $query->whereNull('published_at')->orWhere('published_at', '>=', $windowStart);
            })
            ->count();

        $reactions = SocialPostReaction::query()
            ->whereHas('post', fn ($query) => $query->where('user_id', $user->id))
            ->count();

        $comments = SocialPostComment::query()
            ->whereHas('post', fn ($query) => $query->where('user_id', $user->id))
            ->count();

        $impressions = SocialPostImpression::query()
            ->whereHas('post', fn ($query) => $query->where('user_id', $user->id))
            ->count();

        $topPost = SocialPost::query()
            ->where('user_id', $user->id)
            ->withCount(['reactions', 'comments', 'impressions'])
            ->orderByDesc(DB::raw('COALESCE(reactions_count, 0) * 3 + COALESCE(comments_count, 0) * 5 + COALESCE(impressions_count, 0)'))
            ->first();

        $topSummary = null;
        if ($topPost) {
            $topScore = ($topPost->reactions_count ?? 0) * 3
                + ($topPost->comments_count ?? 0) * 5
                + ($topPost->impressions_count ?? 0);

            $topSummary = [
                'id' => $topPost->id,
                'score' => (int) $topScore,
                'published_at' => optional($topPost->published_at)->toIso8601String(),
            ];
        }

        $combinedEngagement = $reactions + $comments;

        return [
            'posts' => [
                'total' => $totalPosts,
                'last_30_days' => $recentPosts,
            ],
            'engagement' => [
                'reactions' => $reactions,
                'comments' => $comments,
                'impressions' => $impressions,
            ],
            'top_post' => $topSummary,
            'trends' => [
                'avg_engagement_per_post' => $totalPosts > 0 ? round($combinedEngagement / $totalPosts, 2) : 0.0,
                'engagement_rate' => $impressions > 0 ? round(($combinedEngagement / $impressions) * 100, 1) : 0.0,
            ],
        ];
    }

    /**
     * Provide a weekly engagement trend combining reactions, comments, and impressions.
     *
     * @return (((float|int|null|string)[]|float|int|string)[]|bool)[]
     *
     * @psalm-return array{range: array{from: string, to: string, weeks: int<1, 12>}, series: list{0?: array{week_start: string, label: string, reactions: int, comments: int, impressions: int, engagement_score: int},...}, summary: array{total_reactions: int, total_comments: int, total_impressions: int, average_engagement: float, momentum: array{direction: 'declining'|'rising'|'stable', change: int<min, max>, percent: float|null}}, highlights: list<non-empty-string>, fallback: bool}
     */
    public function engagementTimeline(User $user, int $weeks = 6): array
    {
        $weeks = max(1, min(12, $weeks));

        $now = Carbon::now();
        $rangeEnd = $now->copy()->endOfWeek();
        $rangeStart = $rangeEnd->copy()->subWeeks($weeks - 1)->startOfWeek();

        $postIds = SocialPost::query()
            ->where('user_id', $user->id)
            ->pluck('id');

        $hasPosts = $postIds->isNotEmpty();

        $reactionSamples = $hasPosts
            ? SocialPostReaction::query()
                ->whereHas('post', fn ($query) => $query->whereIn('id', $postIds))
                ->where(function ($query) use ($rangeStart, $rangeEnd) {
                    $query->whereBetween('liked_at', [$rangeStart, $rangeEnd])
                        ->orWhereBetween('created_at', [$rangeStart, $rangeEnd]);
                })
                ->get(['liked_at', 'created_at'])
            : collect();

        $commentSamples = $hasPosts
            ? SocialPostComment::query()
                ->whereIn('social_post_id', $postIds)
                ->whereBetween('created_at', [$rangeStart, $rangeEnd])
                ->get(['created_at'])
            : collect();

        $impressionSamples = $hasPosts
            ? SocialPostImpression::query()
                ->whereIn('social_post_id', $postIds)
                ->whereBetween('viewed_at', [$rangeStart, $rangeEnd])
                ->get(['viewed_at'])
                ->filter(fn ($impression) => $impression->viewed_at !== null)
            : collect();

        $reactionByWeek = $this->groupEventsByWeek($reactionSamples, function ($reaction) {
            return $reaction->liked_at ?? $reaction->created_at;
        });

        $commentByWeek = $this->groupEventsByWeek($commentSamples, function ($comment) {
            return $comment->created_at;
        });

        $impressionByWeek = $this->groupEventsByWeek($impressionSamples, function ($impression) {
            return $impression->viewed_at;
        });

        $series = [];
        $cursor = $rangeStart->copy();

        for ($index = 0; $index < $weeks; $index++) {
            $weekKey = $cursor->toDateString();

            $reactions = (int) ($reactionByWeek->get($weekKey, 0));
            $comments = (int) ($commentByWeek->get($weekKey, 0));
            $impressions = (int) ($impressionByWeek->get($weekKey, 0));

            $engagementScore = (int) round(($reactions * 3) + ($comments * 4) + ($impressions * 0.25));

            $series[] = [
                'week_start' => $weekKey,
                'label' => $cursor->format('M d'),
                'reactions' => $reactions,
                'comments' => $comments,
                'impressions' => $impressions,
                'engagement_score' => $engagementScore,
            ];

            $cursor->addWeek();
        }

        $seriesCollection = collect($series);

        $totalReactions = (int) $reactionByWeek->sum();
        $totalComments = (int) $commentByWeek->sum();
        $totalImpressions = (int) $impressionByWeek->sum();
        $avgEngagement = round($seriesCollection->avg('engagement_score') ?? 0, 1);

        $momentumDirection = 'stable';
        $momentumChange = 0;
        $momentumPercent = null;

        if ($seriesCollection->count() >= 2) {
            $latest = $seriesCollection->last();
            $previous = $seriesCollection->slice(-2, 1)->first();

            $momentumChange = $latest['engagement_score'] - $previous['engagement_score'];

            if ($momentumChange > 3) {
                $momentumDirection = 'rising';
            } elseif ($momentumChange < -3) {
                $momentumDirection = 'declining';
            }

            if ($previous['engagement_score'] > 0) {
                $momentumPercent = round(($momentumChange / $previous['engagement_score']) * 100, 1);
            }
        }

        $highlights = [];

        if ($seriesCollection->isNotEmpty()) {
            $latest = $seriesCollection->last();
            $baseline = $seriesCollection->avg('engagement_score') ?? 0;

            if ($momentumDirection === 'rising' && $momentumChange > 0) {
                $highlights[] = sprintf('Engagement increased by %d points versus last week.', $momentumChange);
            }

            if ($latest['comments'] >= max(3, ($seriesCollection->avg('comments') ?? 0) * 1.5)) {
                $highlights[] = 'Conversation activity is spiking; keep the discussion going.';
            }

            if ($latest['engagement_score'] >= max(10, $baseline * 1.2)) {
                $highlights[] = 'This week is outperforming your recent average engagement.';
            }
        }

        $fallback = ($totalReactions + $totalComments + $totalImpressions) === 0;

        return [
            'range' => [
                'from' => $seriesCollection->first()['week_start'] ?? $rangeStart->toDateString(),
                'to' => $seriesCollection->last()['week_start'] ?? $rangeEnd->copy()->startOfWeek()->toDateString(),
                'weeks' => $weeks,
            ],
            'series' => $series,
            'summary' => [
                'total_reactions' => $totalReactions,
                'total_comments' => $totalComments,
                'total_impressions' => $totalImpressions,
                'average_engagement' => $avgEngagement,
                'momentum' => [
                    'direction' => $momentumDirection,
                    'change' => $momentumChange,
                    'percent' => $momentumPercent,
                ],
            ],
            'highlights' => array_values(array_unique($highlights)),
            'fallback' => $fallback,
        ];
    }

    /**
     * @psalm-return Collection<array-key, int>|Collection<never, never>
     */
    private function groupEventsByWeek(Collection $items, callable $timestampResolver): Collection
    {
        if ($items->isEmpty()) {
            return collect();
        }

        return $items
            ->map(fn ($item) => $timestampResolver($item))
            ->filter()
            ->map(function ($timestamp) {
                $instance = $timestamp instanceof Carbon
                    ? $timestamp->copy()
                    : Carbon::parse($timestamp);

                return $instance->startOfWeek()->toDateString();
            })
            ->countBy();
    }

    /**
     * Surface the top performing posts from the recent activity window.
     *
     * @return ((((int|string)[]|int|string)[]|float|int|null|string)[]|bool)[]
     *
     * @psalm-return array{posts: list{0?: array{id: int, content_preview: string, published_at: string, engagement: array{reactions: int, comments: int, impressions: int, score: int}, hashtags: array<int, string>},...}, insights: list<non-empty-string>, recommendations: list{0?: 'Add a clear call-to-action in captions to boost reactions and comments.'|'Experiment with richer media to increase impression volume.'|'Share a new update to gather engagement insights for this period.',...}, meta: array{window_start: string, window_end: string, total_posts: int, top_hashtag: null|string, top_day: null|string, average_score?: float}, fallback: bool}
     */
    public function contentHighlights(User $user, int $limit = 5): array
    {
        $limit = max(1, min(10, $limit));
        $windowEnd = Carbon::now();
        $windowStart = $windowEnd->copy()->subDays(45);

        $postsQuery = SocialPost::query()
            ->where('user_id', $user->id)
            ->whereNull('deleted_at')
            ->where(function ($query) use ($windowStart) {
                $query->whereNull('published_at')->orWhere('published_at', '>=', $windowStart);
            })
            ->withCount([
                'reactions as recent_reactions_count' => fn ($query) => $query->where('created_at', '>=', $windowStart),
                'comments as recent_comments_count' => fn ($query) => $query->where('created_at', '>=', $windowStart),
                'impressions as recent_impressions_count' => fn ($query) => $query->where('viewed_at', '>=', $windowStart),
            ])
            ->orderByDesc(DB::raw(
                'COALESCE(recent_reactions_count, 0) * 3 '
                . '+ COALESCE(recent_comments_count, 0) * 4 '
                . '+ COALESCE(recent_impressions_count, 0) * 0.25'
            ))
            ->take($limit);

        $posts = $postsQuery->get();

        if ($posts->isEmpty()) {
            return [
                'posts' => [],
                'insights' => [],
                'recommendations' => [
                    'Share a new update to gather engagement insights for this period.',
                ],
                'meta' => [
                    'window_start' => $windowStart->toDateString(),
                    'window_end' => $windowEnd->toDateString(),
                    'total_posts' => 0,
                    'top_hashtag' => null,
                    'top_day' => null,
                ],
                'fallback' => true,
            ];
        }

        $postsPayload = [];
        $hashtagScores = [];
        $dayScores = [];

        foreach ($posts as $post) {
            $reactions = (int) ($post->recent_reactions_count ?? 0);
            $comments = (int) ($post->recent_comments_count ?? 0);
            $impressions = (int) ($post->recent_impressions_count ?? 0);
            $score = (int) round(($reactions * 3) + ($comments * 4) + ($impressions * 0.25));

            $tags = collect($post->meta['hashtags'] ?? [])
                ->merge($this->extractHashtags($post->content))
                ->map(fn ($tag) => $this->normalizeTag($tag))
                ->filter()
                ->unique()
                ->values();

            foreach ($tags as $tag) {
                $hashtagScores[$tag] = ($hashtagScores[$tag] ?? 0) + $score;
            }

            $publishedDay = $post->published_at?->format('l');
            if ($publishedDay) {
                $dayScores[$publishedDay] = ($dayScores[$publishedDay] ?? 0) + $score;
            }

            $postsPayload[] = [
                'id' => $post->id,
                'content_preview' => Str::of((string) $post->content)->limit(120)->value(),
                'published_at' => optional($post->published_at)->toIso8601String(),
                'engagement' => [
                    'reactions' => $reactions,
                    'comments' => $comments,
                    'impressions' => $impressions,
                    'score' => $score,
                ],
                'hashtags' => $tags->map(fn ($tag) => '#' . $tag)->all(),
            ];
        }

        $postsCollection = collect($postsPayload);
        $avgImpressions = $postsCollection->avg(fn ($post) => $post['engagement']['impressions']) ?? 0;
        $avgScore = $postsCollection->avg(fn ($post) => $post['engagement']['score']) ?? 0;

        arsort($hashtagScores);
        $topHashtag = array_key_first($hashtagScores);

        arsort($dayScores);
        $topDay = array_key_first($dayScores);

        $insights = [];
        if ($topHashtag) {
            $insights[] = sprintf('Posts with #%s are performing best this period.', $topHashtag);
        }

        if ($topDay) {
            $insights[] = sprintf('%s posts are driving the highest engagement.', $topDay);
        }

        $recommendations = [];
        if ($avgImpressions < 5) {
            $recommendations[] = 'Experiment with richer media to increase impression volume.';
        }

        if ($avgScore < 12) {
            $recommendations[] = 'Add a clear call-to-action in captions to boost reactions and comments.';
        }

        return [
            'posts' => $postsPayload,
            'insights' => array_values(array_unique($insights)),
            'recommendations' => array_values(array_unique($recommendations)),
            'meta' => [
                'window_start' => $windowStart->toDateString(),
                'window_end' => $windowEnd->toDateString(),
                'total_posts' => $postsCollection->count(),
                'top_hashtag' => $topHashtag ? '#' . $topHashtag : null,
                'top_day' => $topDay,
                'average_score' => round($avgScore, 1),
            ],
            'fallback' => false,
        ];
    }

    /**
     * Generate hashtag suggestions based on recent public social posts.
     *
     * @return (float|string)[][]
     *
     * @psalm-return array<int, array{tag: string, score: float}>
     */
    public function hashtagSuggestions(?string $topic, int $limit = 10): array
    {
        $limit = max(1, min(20, $limit));
        $topicNormalized = $this->normalizeTag($topic ?? '');
        $topicNeedle = $topicNormalized ? Str::replace(' ', '', $topicNormalized) : null;

        $recentPosts = SocialPost::query()
            ->visible()
            ->public()
            ->where(function ($query) {
                $threshold = Carbon::now()->subDays(45);
                $query->whereNull('published_at')->orWhere('published_at', '>=', $threshold);
            })
            ->get(['content', 'meta']);

        $scores = [];

        foreach ($recentPosts as $post) {
            $rawTags = collect($post->meta['hashtags'] ?? [])
                ->merge($this->extractHashtags($post->content));

            $normalized = $rawTags
                ->map(fn ($tag) => $this->normalizeTag($tag))
                ->filter();

            foreach ($normalized as $tag) {
                $increment = 1.0;

                if ($topicNeedle && str_contains($tag, $topicNeedle)) {
                    $increment += 1.5;
                }

                $scores[$tag] = ($scores[$tag] ?? 0) + $increment;
            }
        }

        if ($topicNeedle && empty($scores)) {
            $seed = $this->normalizeTag($topicNeedle);
            if ($seed) {
                $scores[$seed] = 1.0;
            }
        }

        return collect($scores)
            ->map(fn ($score, $tag) => [
                'tag' => '#' . $tag,
                'score' => round($score, 2),
            ])
            ->sortByDesc(fn ($item) => $item['score'])
            ->take($limit)
            ->values()
            ->all();
    }

    /**
     * @return (array|float|mixed|null)[]
     *
     * @psalm-return array{id: mixed|null, name: mixed|null, score: float, reason: mixed|null, meta: array<'city'|'experience_id'|'profession_id', mixed>}
     */
    private function formatConnectionPayload(array $item): array
    {
        $recommended = $item['user'] ?? null;
        $candidate = $recommended?->candidate;

        return [
            'id' => $recommended?->id,
            'name' => $recommended?->name ?? $candidate?->full_name,
            'score' => round((float) ($item['score'] ?? 0), 2),
            'reason' => $item['reason'] ?? null,
            'meta' => array_filter([
                'city' => $candidate?->city,
                'experience_id' => $candidate?->experience_id,
                'profession_id' => $candidate?->profession_id,
            ], fn ($value) => $value !== null && $value !== ''),
        ];
    }

    /**
     * @return string[]
     *
     * @psalm-return list<string>
     */
    private function extractHashtags(?string $content): array
    {
        if (! $content) {
            return [];
        }

        preg_match_all('/#([\pL0-9_]+)/u', $content, $matches);

        return $matches[1] ?? [];
    }

    private function normalizeTag(?string $tag): string|null
    {
        if ($tag === null) {
            return null;
        }

        $normalized = Str::of($tag)
            ->lower()
            ->ltrim('#')
            ->replaceMatches('/[^a-z0-9]+/i', '')
            ->substr(0, 30)
            ->value();

        return $normalized !== '' ? $normalized : null;
    }

    private function resolveCandidate(User $user): ?Candidate
    {
        return $user->candidate()
            ->with(['skills', 'experiences'])
            ->first();
    }

    private function resolveSocialProfile(User $user): ?SocialProfile
    {
        if ($user->relationLoaded('socialProfile') && $user->socialProfile) {
            return $user->socialProfile;
        }

        $profile = $user->socialProfile()->first();
        if ($profile) {
            return $profile;
        }

        $candidateProfile = $user->candidate?->socialProfile;
        if ($candidateProfile) {
            return $candidateProfile;
        }

        $companyProfile = $user->company?->socialProfile;
        if ($companyProfile) {
            return $companyProfile;
        }

        return SocialProfile::query()
            ->where('profileable_type', User::class)
            ->where('profileable_id', $user->id)
            ->first();
    }

    /**
     * @return (int|string)[]
     *
     * @psalm-return array{label: string, score: int, status: string, message: string}
     */
    private function componentPayload(string $label, int $score, string $status, string $message): array
    {
        return [
            'label' => $label,
            'score' => $score,
            'status' => $status,
            'message' => $message,
        ];
    }
}

