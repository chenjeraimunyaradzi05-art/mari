<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Models\AgentProfile;
use App\Models\User;
use App\Models\WomenRealEstate\WomenAgentLead;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenListingPartnerIntention;
use App\Models\WomenRealEstate\WomenPropertyMatch;
use App\Models\WomenRealEstate\WomenRentalInquiry;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class AgentPulseService
{
    private const LOOKBACK_DAYS = 14;

    /**
     * @return (array|null)[]
     *
     * @psalm-return array{agent: array{id: int, status: string, verification_stage: null|string}|null, profile: array{id: int, availability_status: string, calendly_url: null|string}|null, metrics: array{match_confidence: float|null, live_leads: int, response_time_minutes: float|null, warm_referrals: int, pulse_score: float, watchlist_overlap: float|null}, archetypes: array, feed: array, bookings: array, meta: array{lookback_days: 14, generated_at: string}}
     */
    public function snapshotFor(User $user): array
    {
        $profile = $user->agentProfile;

        /** @var WomenVerifiedAgent|null $agent */
        $agent = WomenVerifiedAgent::query()
            ->where('user_id', $user->id)
            ->first();

        $listingIds = $agent
            ? WomenListing::query()
                ->where('agent_id', $agent->id)
                ->pluck('id')
            : collect();

        $windowStart = CarbonImmutable::now()->subDays(self::LOOKBACK_DAYS);

        $matchConfidence = $this->averageMatchScore($listingIds, $windowStart);
        $liveLeads = $agent ? $this->liveLeadCount($agent, $windowStart) : 0;
        $warmReferrals = $this->warmReferralCount($listingIds, $windowStart);
        $responseTimeMinutes = $this->averageResponseMinutes($user, $windowStart);
        $watchlistOverlap = $this->watchlistOverlap($listingIds, $windowStart);

        $pulseScore = $this->computePulseScore(
            $matchConfidence,
            $liveLeads,
            $responseTimeMinutes,
            $warmReferrals
        );

        $archetypes = $agent
            ? $this->resolveArchetypes($agent, $windowStart)
            : [];

        $feed = $this->buildFeed($agent, $listingIds);
        $bookings = $this->buildBookingSnapshot($user, $profile);

        return [
            'agent' => $agent ? [
                'id' => $agent->id,
                'status' => $agent->status,
                'verification_stage' => $agent->verification_stage?->value,
            ] : null,
            'profile' => $profile ? [
                'id' => $profile->id,
                'availability_status' => $profile->availability_status,
                'calendly_url' => $profile->calendly_url,
            ] : null,
            'metrics' => [
                'match_confidence' => $matchConfidence,
                'live_leads' => $liveLeads,
                'response_time_minutes' => $responseTimeMinutes,
                'warm_referrals' => $warmReferrals,
                'pulse_score' => $pulseScore,
                'watchlist_overlap' => $watchlistOverlap,
            ],
            'archetypes' => $archetypes,
            'feed' => $feed,
            'bookings' => $bookings,
            'meta' => [
                'lookback_days' => self::LOOKBACK_DAYS,
                'generated_at' => Carbon::now()->toIso8601String(),
            ],
        ];
    }

    private function averageMatchScore(Collection $listingIds, CarbonImmutable $windowStart): ?float
    {
        if ($listingIds->isEmpty()) {
            return null;
        }

        $average = WomenPropertyMatch::query()
            ->whereIn('listing_id', $listingIds)
            ->where('created_at', '>=', $windowStart)
            ->avg('match_score');

        return $average !== null ? round((float) $average, 1) : null;
    }

    private function liveLeadCount(WomenVerifiedAgent $agent, CarbonImmutable $windowStart): int
    {
        return (int) WomenAgentLead::query()
            ->where('agent_id', $agent->id)
            ->where('created_at', '>=', $windowStart)
            ->whereNotIn('status', ['archived'])
            ->count();
    }

    private function warmReferralCount(Collection $listingIds, CarbonImmutable $windowStart): int
    {
        if ($listingIds->isEmpty()) {
            return 0;
        }

        return (int) WomenListingPartnerIntention::query()
            ->whereIn('listing_id', $listingIds)
            ->where('status', 'accepted')
            ->where('updated_at', '>=', $windowStart)
            ->count();
    }

    private function averageResponseMinutes(User $user, CarbonImmutable $windowStart): ?float
    {
        $inquiries = WomenRentalInquiry::query()
            ->where('landlord_user_id', $user->id)
            ->whereNotNull('responded_at')
            ->where('created_at', '>=', $windowStart)
            ->get();

        if ($inquiries->isEmpty()) {
            return null;
        }

        $averageMinutes = $inquiries
            ->map(static function (WomenRentalInquiry $inquiry): ?float {
                if (! $inquiry->responded_at || ! $inquiry->created_at) {
                    return null;
                }

                return (float) $inquiry->responded_at->diffInMinutes($inquiry->created_at);
            })
            ->filter()
            ->avg();

        return $averageMinutes !== null ? round($averageMinutes, 1) : null;
    }

    private function watchlistOverlap(Collection $listingIds, CarbonImmutable $windowStart): ?float
    {
        if ($listingIds->isEmpty()) {
            return null;
        }

        $baseQuery = WomenPropertyMatch::query()
            ->whereIn('listing_id', $listingIds)
            ->where('created_at', '>=', $windowStart);

        $total = (clone $baseQuery)->count();

        if ($total === 0) {
            return null;
        }

        $engaged = (clone $baseQuery)
            ->whereIn('match_status', ['viewed', 'inquired'])
            ->count();

        return $engaged === 0
            ? 0.0
            : round($engaged / $total, 4);
    }

    /**
     * @return (int|string)[][]
     *
     * @psalm-return array<int, array{label: string, count: int}>
     */
    private function resolveArchetypes(WomenVerifiedAgent $agent, CarbonImmutable $windowStart): array
    {
        return WomenAgentLead::query()
            ->select('type')
            ->selectRaw('COUNT(*) as aggregate')
            ->where('agent_id', $agent->id)
            ->where('created_at', '>=', $windowStart)
            ->groupBy('type')
            ->orderByDesc('aggregate')
            ->limit(4)
            ->get()
            ->map(/**
             * @return (int|string)[]
             *
             * @psalm-return array{label: string, count: int}
             */
            static function ($row): array {
                $label = $row->type ? Str::headline($row->type) : 'Lead';

                return [
                    'label' => $label,
                    'count' => (int) ($row->aggregate ?? 0),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @psalm-return array<int, never>
     */
    private function buildFeed(?WomenVerifiedAgent $agent, Collection $listingIds): array
    {
        $entries = collect();

        if ($agent) {
            $leadEntries = WomenAgentLead::query()
                ->where('agent_id', $agent->id)
                ->latest('created_at')
                ->limit(5)
                ->get()
                ->map(/**
                 * @return (null|string)[]
                 *
                 * @psalm-return array{timestamp: null|string, label: 'Lead', message: string}
                 */
                static function (WomenAgentLead $lead): array {
                    $source = $lead->source ? Str::headline($lead->source) : 'Direct';
                    $type = $lead->type ? Str::headline($lead->type) : 'Lead';

                    return [
                        'timestamp' => optional($lead->created_at)?->toIso8601String(),
                        'label' => 'Lead',
                        'message' => sprintf('%s via %s · %s', $type, $source, Str::title($lead->status ?? 'new')),
                    ];
                });

            $entries = $entries->merge($leadEntries);
        }

        if ($listingIds->isNotEmpty()) {
            $intentionEntries = WomenListingPartnerIntention::query()
                ->whereIn('listing_id', $listingIds)
                ->latest('updated_at')
                ->limit(3)
                ->get()
                ->map(/**
                 * @return (null|string)[]
                 *
                 * @psalm-return array{timestamp: null|string, label: 'Referral', message: string}
                 */
                static function (WomenListingPartnerIntention $intention): array {
                    $intent = Str::headline($intention->intent ?? 'Partner');

                    return [
                        'timestamp' => optional($intention->updated_at)?->toIso8601String(),
                        'label' => 'Referral',
                        'message' => sprintf('%s intent is %s', $intent, Str::title($intention->status ?? 'pending')),
                    ];
                });

            $entries = $entries->merge($intentionEntries);
        }

        return $entries
            ->filter(static fn (array $row) => $row['timestamp'] ?? null)
            ->sortByDesc('timestamp')
            ->take(5)
            ->values()
            ->all();
    }

    /**
     * @return (int|null|string)[]
     *
     * @psalm-return array{scheduled_tours: int, pending_tours: int, engaged_leads: int, next_tour_at: null|string, next_tour_at_human: null|string, next_tour_from_now: null|string, availability_status: null|string, calendly_url: null|string}
     */
    private function buildBookingSnapshot(User $user, ?AgentProfile $profile): array
    {
        $now = Carbon::now();

        $scheduledTours = WomenRentalInquiry::query()
            ->where('landlord_user_id', $user->id)
            ->whereIn('status', ['scheduled', 'accepted'])
            ->count();

        $pendingTours = WomenRentalInquiry::query()
            ->where('landlord_user_id', $user->id)
            ->whereIn('status', ['pending', 'interested'])
            ->count();

        $nextTour = WomenRentalInquiry::query()
            ->where('landlord_user_id', $user->id)
            ->whereNotNull('scheduled_tour_at')
            ->where('scheduled_tour_at', '>=', $now)
            ->orderBy('scheduled_tour_at')
            ->value('scheduled_tour_at');

        $nextTourCarbon = $nextTour ? Carbon::parse($nextTour)->timezone(config('app.timezone')) : null;
        $nextTourFromNow = $nextTourCarbon
            ? $nextTourCarbon->diffForHumans(null, [
                'parts' => 2,
                'short' => true,
                'syntax' => \Carbon\CarbonInterface::DIFF_ABSOLUTE,
            ])
            : null;

        $engagedLeads = WomenAgentLead::query()
            ->whereHas('agent', static function ($query) use ($user): void {
                $query->where('user_id', $user->id);
            })
            ->where('status', 'engaged')
            ->count();

        return [
            'scheduled_tours' => (int) $scheduledTours,
            'pending_tours' => (int) $pendingTours,
            'engaged_leads' => (int) $engagedLeads,
            'next_tour_at' => $nextTourCarbon?->toIso8601String(),
            'next_tour_at_human' => $nextTourCarbon?->format('D • h:ia'),
            'next_tour_from_now' => $nextTourFromNow,
            'availability_status' => $profile?->availability_status,
            'calendly_url' => $profile?->calendly_url,
        ];
    }

    private function computePulseScore(?float $matchConfidence, int $liveLeads, ?float $responseMinutes, int $warmReferrals): float
    {
        $matchScore = $matchConfidence !== null ? $matchConfidence / 100 : 0.5;
        $leadScore = 1 - exp(-max($liveLeads, 0) / 8);
        $responseScore = $responseMinutes !== null
            ? max(0.0, min(1.0, 1 - ($responseMinutes / 45)))
            : 0.6;
        $referralScore = 1 - exp(-max($warmReferrals, 0) / 5);

        $score = (0.35 * $matchScore)
            + (0.25 * $leadScore)
            + (0.2 * $responseScore)
            + (0.2 * $referralScore);

        return round($score * 100, 1);
    }
}

