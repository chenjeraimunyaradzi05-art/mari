<?php

namespace App\Services\Social;

use App\Models\Connection;
use App\Models\ConversationMessage;
use App\Models\IncidentReport;
use App\Models\Invite;
use App\Models\Profile;
use App\Models\SocialMetricsDaily;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SocialMetricsAggregationService
{
    protected bool $extendedHeatmapEnabled;

    protected int $heatmapLookbackDays;

    /** @var array<int, int> */
    protected array $heatmapRanges;

    protected int $maxCohortTags;

    public function __construct()
    {
        $heatmap = (array) config('social.metrics.heatmap', []);

        $this->extendedHeatmapEnabled = (bool) ($heatmap['extended_enabled'] ?? true);
        $this->heatmapLookbackDays = (int) ($heatmap['lookback_days'] ?? 45);
        $this->heatmapRanges = (array) ($heatmap['ranges'] ?? [7, 30]);

        $this->maxCohortTags = max(1, (int) config('social.metrics.cohort.max_tags', 3));
    }

    protected bool $heatmapDisabledLogged = false;

    protected bool $heatmapLookbackLogged = false;

    /**
     * @psalm-return int<0, max>
     */
    public function capture(CarbonInterface $date, ?int $personaId = null, bool $force = false): int
    {
        $captureDate = $date->copy();
        $rangeStart = $captureDate->copy()->startOfDay();
        $rangeEnd = $captureDate->copy()->endOfDay();
        $captureKey = $captureDate->toDateString();

        $query = Profile::query()
            ->select([
                'id',
                'user_id',
                'persona_type',
                'privacy_level',
                'privacy_tier',
                'women_safety_mode',
                'social_profile_id',
                'goals',
            ])
            ->where('is_active', true)
            ->with(['personaSocialProfile:id,is_verified']);

        if ($personaId !== null) {
            $query->whereKey($personaId);
        }

        $processed = 0;

        $query->chunkById(200, function ($profiles) use (&$processed, $rangeStart, $rangeEnd, $captureKey, $force) {
            $existing = SocialMetricsDaily::query()
                ->where('captured_on', $captureKey)
                ->whereIn('persona_id', $profiles->pluck('id'))
                ->pluck('id', 'persona_id');

            foreach ($profiles as $profile) {
                if (! $force && $existing->has($profile->id)) {
                    continue;
                }

                $metrics = $this->buildMetricsForProfile($profile, $rangeStart, $rangeEnd);

                SocialMetricsDaily::updateOrCreate(
                    [
                        'captured_on' => $captureKey,
                        'persona_id' => $profile->id,
                    ],
                    [
                        'total_connections' => $metrics['total_connections'],
                        'total_invites_sent' => $metrics['total_invites_sent'],
                        'total_invites_accepted' => $metrics['total_invites_accepted'],
                        'messaging_civility_score' => $metrics['messaging_civility_score'],
                        'connection_heatmap_bins' => $metrics['connection_heatmap_bins'],
                        'connection_heatmap_bins_30d' => $metrics['connection_heatmap_bins_30d'],
                        'invite_funnel_bins' => $metrics['invite_funnel_bins'],
                        'cohort_tags' => $metrics['cohort_tags'],
                        'primary_cohort' => $metrics['primary_cohort'],
                    ]
                );

                $processed++;
            }
        });

        return $processed;
    }

    /**
     * @return ((float|int|mixed|null)[]|float|int|mixed|null)[]
     *
     * @psalm-return array{total_connections: int, total_invites_sent: int<min, max>, total_invites_accepted: int, messaging_civility_score: 0|float|null, connection_heatmap_bins: array{daily: mixed, daily_7: mixed, daily_30: mixed, pending: mixed}, connection_heatmap_bins_30d: mixed, invite_funnel_bins: array{sent: int, accepted: int, conversion_rate: float|null}, cohort_tags: mixed, primary_cohort: mixed}
     */
    protected function buildMetricsForProfile(Profile $profile, CarbonInterface $rangeStart, CarbonInterface $rangeEnd): array
    {
        $totalConnections = $this->countConnections($profile, $rangeEnd);
        $invitesSent = $this->countInvitesSent($profile, $rangeStart, $rangeEnd);
        $invitesAccepted = $this->countInvitesAccepted($profile, $rangeStart, $rangeEnd);
        $messagesSent = $this->countMessages($profile, $rangeStart, $rangeEnd);
        $incidentsFiled = $this->countIncidents($profile, $rangeStart, $rangeEnd);
        $heatmapSlices = $this->buildHeatmapPayload($profile, $rangeEnd);
        $cohortMetadata = $this->deriveCohortTags($profile);

        $civilityScore = $messagesSent === 0
            ? null
            : max(0, round(100 - (($incidentsFiled / max(1, $messagesSent)) * 100), 2));

        $inviteBins = [
            'sent' => $invitesSent,
            'accepted' => $invitesAccepted,
            'conversion_rate' => $invitesSent > 0
                ? round(($invitesAccepted / $invitesSent) * 100, 1)
                : null,
        ];

        $connectionHeatmapPayload = [
            'daily' => $heatmapSlices['seven_day']['daily'],
            'daily_7' => $heatmapSlices['seven_day']['daily'],
            'daily_30' => $heatmapSlices['thirty_day'],
            'pending' => $heatmapSlices['seven_day']['pending'],
        ];

        return [
            'total_connections' => $totalConnections,
            'total_invites_sent' => $invitesSent,
            'total_invites_accepted' => $invitesAccepted,
            'messaging_civility_score' => $civilityScore,
            'connection_heatmap_bins' => $connectionHeatmapPayload,
            'connection_heatmap_bins_30d' => $heatmapSlices['thirty_day'],
            'invite_funnel_bins' => $inviteBins,
            'cohort_tags' => $cohortMetadata['tags'],
            'primary_cohort' => $cohortMetadata['primary'],
        ];
    }

    protected function countConnections(Profile $profile, CarbonInterface $rangeEnd): int
    {
        return Connection::query()
            ->where('status', Connection::STATUS_ACCEPTED)
            ->where('updated_at', '<=', $rangeEnd)
            ->where(function ($query) use ($profile) {
                $query->where('user_id', $profile->user_id)
                    ->orWhere('connected_user_id', $profile->user_id);
            })
            ->count();
    }

    protected function countInvitesSent(Profile $profile, CarbonInterface $rangeStart, CarbonInterface $rangeEnd): int
    {
        return Invite::query()
            ->where('sender_profile_id', $profile->id)
            ->whereBetween('created_at', [$rangeStart, $rangeEnd])
            ->count();
    }

    protected function countInvitesAccepted(Profile $profile, CarbonInterface $rangeStart, CarbonInterface $rangeEnd): int
    {
        return Invite::query()
            ->where('sender_profile_id', $profile->id)
            ->whereNotNull('accepted_at')
            ->whereBetween('accepted_at', [$rangeStart, $rangeEnd])
            ->count();
    }

    protected function countMessages(Profile $profile, CarbonInterface $rangeStart, CarbonInterface $rangeEnd): int
    {
        return ConversationMessage::query()
            ->where('sender_profile_id', $profile->id)
            ->where('is_system', false)
            ->where(function ($query) use ($rangeStart, $rangeEnd) {
                $query->whereBetween('sent_at', [$rangeStart, $rangeEnd])
                    ->orWhere(function ($inner) use ($rangeStart, $rangeEnd) {
                        $inner->whereNull('sent_at')
                            ->whereBetween('created_at', [$rangeStart, $rangeEnd]);
                    });
            })
            ->count();
    }

    protected function countIncidents(Profile $profile, CarbonInterface $rangeStart, CarbonInterface $rangeEnd): int
    {
        return IncidentReport::query()
            ->where(function ($query) use ($profile) {
                $query->where('subject_user_id', $profile->user_id)
                    ->orWhere('metadata->subject_profile_id', $profile->id);
            })
            ->where(function ($query) use ($rangeStart, $rangeEnd) {
                $query->whereBetween('occurred_at', [$rangeStart, $rangeEnd])
                    ->orWhere(function ($inner) use ($rangeStart, $rangeEnd) {
                        $inner->whereNull('occurred_at')
                            ->whereBetween('created_at', [$rangeStart, $rangeEnd]);
                    });
            })
            ->count();
    }

    /**
     * @return (array|mixed|null)[]
     *
     * @psalm-return array{seven_day: array, thirty_day: mixed|null}
     */
    protected function buildHeatmapPayload(Profile $profile, CarbonInterface $rangeEnd): array
    {
        $sevenDay = $this->buildConnectionHeatmap($profile, $rangeEnd, 7);

        $payload = [
            'seven_day' => $sevenDay,
            'thirty_day' => null,
        ];

        if (! $this->extendedHeatmapEnabled) {
            $this->logExtendedHeatmapNotice('disabled', $profile, $rangeEnd, once: true);

            return $payload;
        }

        if ($this->heatmapLookbackDays < 30 || ! in_array(30, $this->heatmapRanges, true)) {
            $this->logExtendedHeatmapNotice('lookback_limit', $profile, $rangeEnd, once: true);

            return $payload;
        }

        $thirtyDay = $this->buildConnectionHeatmap($profile, $rangeEnd, 30);
        $payload['thirty_day'] = $thirtyDay['daily'];

        if (empty($thirtyDay['daily'])) {
            $this->logExtendedHeatmapNotice('insufficient_history', $profile, $rangeEnd);
        }

        return $payload;
    }

    /**
     * @return int[][]
     *
     * @psalm-return array{daily: array<int>, pending: array{incoming: int, outgoing: int}}
     */
    protected function buildConnectionHeatmap(Profile $profile, CarbonInterface $rangeEnd, int $days = 7): array
    {
        $effectiveDays = max(1, min($days, $this->heatmapLookbackDays));
        $rangeLower = $rangeEnd->copy()->subDays($effectiveDays - 1)->startOfDay();

        $daily = Connection::query()
            ->selectRaw('DATE(updated_at) as bucket_date, COUNT(*) as total')
            ->where('status', Connection::STATUS_ACCEPTED)
            ->whereBetween('updated_at', [$rangeLower, $rangeEnd])
            ->where(function ($query) use ($profile) {
                $query->where('user_id', $profile->user_id)
                    ->orWhere('connected_user_id', $profile->user_id);
            })
            ->groupBy(DB::raw('DATE(updated_at)'))
            ->orderBy('bucket_date')
            ->pluck('total', 'bucket_date')
            ->map(fn ($count) => (int) $count)
            ->all();

        $pendingIncoming = Connection::query()
            ->where('connected_user_id', $profile->user_id)
            ->where('status', Connection::STATUS_PENDING)
            ->count();

        $pendingOutgoing = Connection::query()
            ->where('user_id', $profile->user_id)
            ->where('status', Connection::STATUS_PENDING)
            ->count();

        return [
            'daily' => $daily,
            'pending' => [
                'incoming' => $pendingIncoming,
                'outgoing' => $pendingOutgoing,
            ],
        ];
    }

    /**
     * @return (null|string|string[])[]
     *
     * @psalm-return array{tags: list<non-falsy-string>, primary: null|string}
     */
    protected function deriveCohortTags(Profile $profile): array
    {
        $tags = [
            $profile->persona_type ? 'persona:'.$profile->persona_type : null,
            $profile->privacyTier() ? 'privacy:'.$profile->privacyTier() : null,
        ];

        $isVerified = (bool) optional($profile->personaSocialProfile)->is_verified;
        $tags[] = $isVerified ? 'status:verified' : 'status:unverified';

        if ($profile->women_safety_mode) {
            $tags[] = 'intent:safety_mode';
        }

        if ($this->valueContainsTerm($profile->goals ?? [], 'mentor')) {
            $tags[] = 'intent:mentorship';
        }

        if ($this->valueContainsTerm($profile->goals ?? [], 'network')) {
            $tags[] = 'intent:networking';
        }

        $unique = array_values(array_unique(array_filter($tags)));
        $normalized = array_slice($unique, 0, $this->maxCohortTags);

        return [
            'tags' => $normalized,
            'primary' => $normalized[0] ?? null,
        ];
    }

    protected function valueContainsTerm(array $value, string $needle): bool
    {
        if ($value === null) {
            return false;
        }

        $serialized = is_array($value) ? json_encode($value) : (string) $value;

        return Str::contains(Str::lower($serialized), Str::lower($needle));
    }

    protected function logExtendedHeatmapNotice(string $reason, Profile $profile, CarbonInterface $rangeEnd, bool $once = false): void
    {
        if ($once) {
            if ($reason === 'disabled' && $this->heatmapDisabledLogged) {
                return;
            }

            if ($reason === 'lookback_limit' && $this->heatmapLookbackLogged) {
                return;
            }
        }

        Log::notice('social.metrics.extended_heatmap.notice', [
            'reason' => $reason,
            'profile_id' => $profile->id,
            'captured_on' => $rangeEnd->toDateString(),
        ]);

        if ($reason === 'disabled') {
            $this->heatmapDisabledLogged = true;
        }

        if ($reason === 'lookback_limit') {
            $this->heatmapLookbackLogged = true;
        }
    }
}

