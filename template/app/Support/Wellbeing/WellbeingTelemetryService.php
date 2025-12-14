<?php

namespace App\Support\Wellbeing;

use App\Models\AnalyticsEvent;
use App\Models\Profile;
use App\Models\User;
use App\Models\WellbeingProfile;
use App\Services\RealTimeAnalyticsEngine;
use App\Support\Wellbeing\WellbeingInterestService;
use Illuminate\Support\Carbon;

class WellbeingTelemetryService
{
    private RealTimeAnalyticsEngine $analytics;
    private WellbeingInterestService $interestService;

    public function __construct(?RealTimeAnalyticsEngine $analytics = null, ?WellbeingInterestService $interestService = null)
    {
        $this->analytics = $analytics ?? app(RealTimeAnalyticsEngine::class);
        $this->interestService = $interestService ?? app(WellbeingInterestService::class);
    }
    private const INTERACTION_EVENT_MAP = [
        'event_clicked' => 'wellbeing.event.clicked',
        'event_rsvp' => 'wellbeing.event.rsvp',
        'offer_clicked' => 'wellbeing.offer.clicked',
        'article_opened' => 'wellbeing.article.opened',
        'ask_athena' => 'wellbeing.concierge.opened',
        'hub_loaded' => 'wellbeing.hub.loaded',
        'profile_saved' => 'wellbeing.profile.saved',
    ];

    public function recordHubVisit(User $user, array $interestTags = []): void
    {
        $tags = $this->normalizeInterestTags($user, $interestTags);

        $this->analytics->record('wellbeing.hub.visit', [
            'properties' => [
                'interest_tags' => $tags,
                'preferred_interest' => $this->interestService->preferredInterest($tags),
            ],
            'metadata' => [
                'user_id' => $user->getKey(),
                'profile_exists' => (bool) $user->wellbeingProfile()->exists(),
            ],
            'source' => 'wellbeing.hub',
        ]);
    }

    public function recordProfileSaved(User $user, WellbeingProfile $profile, array $interestTags = []): void
    {
        $tags = $this->normalizeInterestTags($user, $interestTags);

        $this->analytics->record('wellbeing.profile.saved', [
            'properties' => [
                'movement_level' => $profile->movement_level,
                'energy_pattern' => $profile->energy_pattern,
                'has_constraints' => filled($profile->constraints),
                'interest_tags' => $tags,
            ],
            'metadata' => [
                'user_id' => $user->getKey(),
            ],
            'source' => 'wellbeing.hub',
        ]);
    }

    public function recordInteraction(User $user, string $interaction, array $context = []): void
    {
        $eventName = $this->eventNameForInteraction($interaction);
        $tags = $this->normalizeInterestTags($user, $context['interest_tags'] ?? []);

        $this->analytics->record($eventName, [
            'properties' => array_merge([
                'interest_tags' => $tags,
                'preferred_interest' => $this->interestService->preferredInterest($tags),
            ], $context),
            'metadata' => [
                'user_id' => $user->getKey(),
                'interaction' => $interaction,
            ],
            'source' => 'wellbeing.hub',
        ]);
    }

    /**
     * @return (float|int|string)[]
     *
     * @psalm-return array{window_days: int<1, 90>, window_start: string, targeted_members: int<min, max>, engaged_members: int, adoption_rate: float}
     */
    public function adoptionSnapshot(int $windowDays = 30): array
    {
        $days = max(1, min($windowDays, 90));
        $windowStart = now()->subDays($days);

        $targeted = $this->countTargetedMembers();
        $engaged = $this->uniqueVisitorsSince($windowStart);
        $rate = $targeted > 0 ? round(($engaged / $targeted) * 100, 2) : 0.0;

        return [
            'window_days' => $days,
            'window_start' => $windowStart->toIso8601String(),
            'targeted_members' => $targeted,
            'engaged_members' => $engaged,
            'adoption_rate' => $rate,
        ];
    }

    public function adoptionThresholdMet(float $threshold = 60.0, int $windowDays = 30): bool
    {
        $snapshot = $this->adoptionSnapshot($windowDays);

        return $snapshot['adoption_rate'] >= $threshold;
    }

    private function eventNameForInteraction(string $interaction): string
    {
        return self::INTERACTION_EVENT_MAP[$interaction] ?? 'wellbeing.interaction';
    }

    private function normalizeInterestTags(User $user, array $provided = []): array
    {
        $tags = collect($provided)->filter(fn ($value) => is_string($value));

        if ($tags->isEmpty()) {
            $profile = $user->relationLoaded('wellbeingProfile')
                ? $user->wellbeingProfile
                : $user->wellbeingProfile()->first();

            if ($profile) {
                return $this->interestService->tagsFromProfile($profile);
            }

            return $this->interestService->inferFromUser($user);
        }

        if (! $tags->contains('wellness')) {
            $tags->prepend('wellness');
        }

        return $tags->unique()->values()->all();
    }

    private function countTargetedMembers(): int
    {
        $interestIds = User::query()
            ->whereNotNull('interests')
            ->whereJsonContains('interests', 'wellness')
            ->pluck('id');

        $profileIds = WellbeingProfile::query()->pluck('user_id');

        $personaIds = Profile::query()
            ->whereNotNull('health_interests')
            ->whereJsonLength('health_interests', '>', 0)
            ->pluck('user_id');

        return $interestIds
            ->merge($profileIds)
            ->merge($personaIds)
            ->unique()
            ->count();
    }

    private function uniqueVisitorsSince(Carbon $windowStart): int
    {
        return AnalyticsEvent::query()
            ->select('metadata')
            ->where('event', 'wellbeing.hub.visit')
            ->where('received_at', '>=', $windowStart)
            ->get()
            ->map(fn (AnalyticsEvent $event) => $event->metadata['user_id'] ?? null)
            ->filter()
            ->unique()
            ->count();
    }
}

