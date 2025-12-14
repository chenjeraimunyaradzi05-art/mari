<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Enums\WomenRealEstate\PartnerMatchStatus;
use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Models\WomenRealEstate\WomenPartnerMatch;
use App\Models\WomenRealEstate\WomenPartnerProject;
use App\Services\WomenRealEstate\Ai\WomenPartnerAiService;
use App\Services\WomenRealEstate\WomenCohortTimelineService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class WomenPartnerMatchingService
{
    public function __construct(
        private WomenPartnerAiService $partnerAi,
        private WomenCohortTimelineService $timelineService
    ) {
    }

    /**
     * @psalm-return Collection<int, array{profile: WomenCohortProfile, score: float, insights: mixed}>|\Illuminate\Database\Eloquent\Collection<int, array{profile: WomenCohortProfile, score: float, insights: mixed}>
     */
    public function recommendMatches(WomenPartnerProject $project, int $limit = 5): Collection|\Illuminate\Database\Eloquent\Collection
    {
        $profiles = WomenCohortProfile::query()
            ->with('goalTrackers')
            ->where('persona', '!=', 'mentor')
            ->get();

        $ranked = $profiles
            ->map(fn (WomenCohortProfile $profile) => [
                'profile' => $profile,
                'score' => $this->scoreProfileForProject($profile, $project),
            ])
            ->sortByDesc('score')
            ->take($limit)
            ->values();

        $cacheTtl = max(60, (int) config('women_real_estate.ai.cache_ttl.partner_matching', 21_600));

        return $ranked->map(function (array $entry) use ($project, $cacheTtl) {
            $profile = $entry['profile'];
            $score = (float) $entry['score'];
            $cacheKey = $this->previewCacheKey($project, $profile, $score);
            $generatedFreshPreview = false;

            $entry['insights'] = Cache::remember(
                $cacheKey,
                $cacheTtl,
                function () use ($project, $profile, $score, &$generatedFreshPreview) {
                    $generatedFreshPreview = true;

                    return $this->partnerAi->matchNarrative($project, $profile, [
                        'score' => $score,
                        'preview' => true,
                        'confidence' => min(0.99, max(0.4, $score / 100)),
                    ]);
                }
            );

            if ($generatedFreshPreview) {
                $this->timelineService->recordAiGuidanceEvent($profile, $entry['insights'] ?? [], [
                    'source' => 'partner_matching',
                    'subject' => $project->title,
                    'score' => round($score, 1),
                    'event_type' => 'partner_match_preview',
                ]);
            }

            return $entry;
        });
    }

    public function createMatch(WomenPartnerProject $project, WomenCohortProfile $profile, float $score, float $confidence): WomenPartnerMatch
    {
        $insights = $this->partnerAi->matchNarrative($project, $profile, [
            'score' => $score,
            'confidence' => $confidence,
        ]);

        $this->timelineService->recordAiGuidanceEvent($profile, $insights ?? [], [
            'source' => 'partner_matching',
            'subject' => $project->title,
            'score' => round($score, 1),
            'event_type' => 'partner_match_created',
        ]);

        return DB::transaction(function () use ($project, $profile, $score, $confidence, $insights) {
            return WomenPartnerMatch::updateOrCreate(
                [
                    'project_id' => $project->id,
                    'profile_id' => $profile->id,
                ],
                [
                    'match_score' => round($score, 2),
                    'confidence' => round($confidence, 2),
                    'status' => PartnerMatchStatus::PENDING,
                    'notes' => $this->buildNotes($profile, $insights),
                ]
            );
        });
    }

    /**
     * @return (array|mixed)[]
     *
     * @psalm-return array{intent_alignment: array<never, never>|mixed, ai_commentary: mixed, activation_steps: mixed, values_alignment: mixed, ai_provider: mixed}
     */
    private function buildNotes(WomenCohortProfile $profile, array $insights): array
    {
        return [
            'intent_alignment' => $profile->preferences['preferred_listing_types'] ?? [],
            'ai_commentary' => Arr::get($insights, 'summary'),
            'activation_steps' => Arr::get($insights, 'activation_steps', []),
            'values_alignment' => Arr::get($insights, 'values_alignment', []),
            'ai_provider' => Arr::get($insights, 'provider'),
        ];
    }

    private function scoreProfileForProject(WomenCohortProfile $profile, WomenPartnerProject $project): float
    {
        $base = 50.0;

        if ($project->status?->isActive()) {
            $base += 10;
        }

        $preferredTypes = collect($profile->preferences['preferred_listing_types'] ?? []);
        if ($preferredTypes->contains(fn (string $type) => str_contains($project->summary ?? '', $type))) {
            $base += 15;
        }

        $aiScore = (float) ($profile->ai_insights['readiness_score'] ?? 60);

        return min(100, $base + ($aiScore / 4));
    }

    private function previewCacheKey(WomenPartnerProject $project, WomenCohortProfile $profile, float $score): string
    {
        $projectStamp = optional($project->updated_at)->timestamp ?? 0;
        $profileStamp = optional($profile->updated_at)->timestamp ?? 0;

        return sprintf(
            'women:partner:preview:%d:%d:%d:%d:%s',
            $project->id,
            $profile->id,
            $projectStamp,
            $profileStamp,
            number_format($score, 1, '.', '')
        );
    }
}

