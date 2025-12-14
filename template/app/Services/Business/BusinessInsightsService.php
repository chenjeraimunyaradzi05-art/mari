<?php

namespace App\Services\Business;

use App\Models\Business\BusinessProfile;
use App\Models\Business\BusinessResource;
use App\Models\Company;
use App\Models\Job;
use App\Models\SocialPost;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use App\Services\Business\BusinessFeedService;

final class BusinessInsightsService
{
    private BusinessFeedService $feedService;

    public function __construct(BusinessFeedService $feedService)
    {
        $this->feedService = $feedService;
    }

    /**
     * @return (array|null|string)[]
     *
     * @psalm-return array{venture: null|string, tagline: null|string, generated_at: string, hero_theme: string, digest_summary: string, kpis: array{momentum: array{label: 'Momentum', value: int, suffix: '%', helper: 'Add a visible win'|'Glowing pace'}, open_milestones: array{label: 'Open milestones', value: int, helper: string}, weekly_posts: array{label: 'Weekly posts', value: mixed, helper: 'Community sees you'|'Share a behind-the-scenes note'}, resources_ready: array{label: 'Resources saved', value: int, helper: string}}, next_milestone: array{title: string, due_date: string, due_human: string, cta_label: null|string, cta_url: null|string, summary: null|string}|null, resource_spotlight: array{title: string, summary: null|string, cta_label: null|string, cta_url: null|string, badge: string, hero_color: null|string}|null, community_pulse: array, recommendations: array}
     */
    public function snapshot(BusinessProfile $profile): array
    {
        $profile->loadMissing(['milestones', 'user.socialProfile']);

        $metrics = collect($profile->metrics ?? []);
        $milestones = $profile->milestones ?? collect();

        $openMilestones = $milestones->where('status', '!=', 'done')->count();
        $completedMilestones = $milestones->where('status', 'done')->count();
        $dueSoon = $milestones
            ->where('status', '!=', 'done')
            ->filter(fn ($milestone) => $milestone->due_date && $milestone->due_date->isBetween(now(), now()->addDays(10)))
            ->count();

        $nextMilestone = $milestones
            ->where('status', '!=', 'done')
            ->sortBy(fn ($milestone) => $milestone->due_date ?? Carbon::now()->addYears(5))
            ->first();

        $resourceQuery = BusinessResource::published();
        $resourceCount = (clone $resourceQuery)->count();
        $resourceSpotlight = (clone $resourceQuery)
            ->orderByDesc('ai_relevance_score')
            ->limit(1)
            ->get()
            ->map(fn (BusinessResource $resource) => [
                'title' => $resource->title,
                'summary' => $resource->summary,
                'cta_label' => $resource->cta_label,
                'cta_url' => $resource->cta_url,
                'badge' => $resource->badgeLabel(),
                'hero_color' => $resource->hero_color,
            ])
            ->first();

        $communityPulse = $this->communityPulse($profile, $metrics);
        $momentumScore = $this->momentumScore($openMilestones, $completedMilestones, $communityPulse['weekly_posts']);

        $kpis = [
            'momentum' => [
                'label' => 'Momentum',
                'value' => $momentumScore,
                'suffix' => '%',
                'helper' => $momentumScore >= 70 ? 'Glowing pace' : 'Add a visible win',
            ],
            'open_milestones' => [
                'label' => 'Open milestones',
                'value' => $openMilestones,
                'helper' => $dueSoon > 0 ? $dueSoon.' due soon' : 'All feels on track',
            ],
            'weekly_posts' => [
                'label' => 'Weekly posts',
                'value' => $communityPulse['weekly_posts'],
                'helper' => $communityPulse['weekly_posts'] >= 2 ? 'Community sees you' : 'Share a behind-the-scenes note',
            ],
            'resources_ready' => [
                'label' => 'Resources saved',
                'value' => $resourceCount,
                'helper' => $resourceSpotlight ? 'Spotlight: '.$resourceSpotlight['title'] : 'Browse the femme hub',
            ],
        ];

        return [
            'venture' => $profile->venture_name ?? $profile->user?->name,
            'tagline' => $profile->tagline,
            'generated_at' => now()->toIso8601String(),
            'hero_theme' => $profile->hero_theme,
            'digest_summary' => sprintf(
                '%d milestones in motion • %d weekly posts • %d resources bookmarked',
                $openMilestones,
                $communityPulse['weekly_posts'],
                $resourceCount
            ),
            'kpis' => $kpis,
            'next_milestone' => $nextMilestone ? [
                'title' => $nextMilestone->title,
                'due_date' => optional($nextMilestone->due_date)->toDateString(),
                'due_human' => optional($nextMilestone->due_date)->diffForHumans(),
                'cta_label' => $nextMilestone->cta_label,
                'cta_url' => $nextMilestone->cta_url,
                'summary' => $nextMilestone->summary,
            ] : null,
            'resource_spotlight' => $resourceSpotlight,
            'community_pulse' => $communityPulse,
            'recommendations' => $this->recommendations($profile, $metrics, $communityPulse),
        ];
    }

    /**
     * @return (float|int|null)[]
     *
     * @psalm-return array{open_roles?: int, avg_time_to_fill?: int|null, diverse_pipeline_ratio?: float|null}
     */
    public function requisitionHealth(?int $companyId): array
    {
        if (! $companyId) {
            return [];
        }

        $jobs = Job::query()
            ->where('company_id', $companyId)
            ->withCount('applications')
            ->get(['status', 'workflow_priority', 'created_at', 'updated_at']);

        if ($jobs->isEmpty()) {
            return [
                'open_roles' => 0,
                'avg_time_to_fill' => null,
                'diverse_pipeline_ratio' => null,
            ];
        }

        $fillSamples = $jobs->map(function (Job $job) {
            if (! $job->created_at || ! $job->updated_at) {
                return null;
            }

            return $job->updated_at->diffInDays($job->created_at);
        })->filter();

        $avgFillTime = $fillSamples->isNotEmpty()
            ? (int) round($fillSamples->avg())
            : null;

        $diversePipelineRatio = round(
            ($jobs->where('workflow_priority', 'high')->count() / max($jobs->count(), 1)) * 100,
            1
        );

        return [
            'open_roles' => $jobs->where('status', 'open')->count(),
            'avg_time_to_fill' => $avgFillTime,
            'diverse_pipeline_ratio' => $diversePipelineRatio,
        ];
    }

    /**
     * @return (((null|string)[]|string)[]|int|string)[]
     *
     * @psalm-return array{score?: 64|82, last_audit_at?: string, audits?: list{0: array{id: string, title: 'Profile verification', status: 'complete'|'pending', owner: string, due_at: string}, 1?: array{id: string, title: 'Foundation impact disclosure', status: 'in_progress', owner: string, due_at: null|string}}, recommended_actions?: list{'Upload the latest DEI policy summary to your employer profile.', 'Confirm pay transparency ranges across active requisitions.'}}
     */
    public function equityCompliance(?int $companyId): array
    {
        if (! $companyId) {
            return [];
        }

        $company = Company::query()->with('owner')->find($companyId);

        if (! $company) {
            return [];
        }

        $score = $company->is_profile_verified ? 82 : 64;

        $audits = [
            [
                'id' => 'profile-'.$companyId,
                'title' => 'Profile verification',
                'status' => $company->is_profile_verified ? 'complete' : 'pending',
                'owner' => optional($company->owner)->name ?? 'People Team',
                'due_at' => optional($company->verification_submitted_at)->toDateString(),
            ],
        ];

        if ($company->foundation_status === 'active') {
            $foundationDue = optional($company->foundation_launched_at)->addMonths(6);

            $audits[] = [
                'id' => 'foundation-'.$companyId,
                'title' => 'Foundation impact disclosure',
                'status' => 'in_progress',
                'owner' => $company->foundation_contact_name ?? 'Impact Office',
                'due_at' => $foundationDue?->toDateString(),
            ];
        }

        return [
            'score' => $score,
            'last_audit_at' => optional($company->updated_at)->toDateString(),
            'audits' => $audits,
            'recommended_actions' => [
                'Upload the latest DEI policy summary to your employer profile.',
                'Confirm pay transparency ranges across active requisitions.',
            ],
        ];
    }

    /**
     * @return (array|int|mixed|null)[]
     *
     * @psalm-return array{weekly_posts: int<min, max>, avg_engagement: int, trending_tags: array, last_posted: mixed|null}
     */
    private function communityPulse(BusinessProfile $profile, Collection $metrics): array
    {
        $socialProfile = $profile->user?->socialProfile;

        if (! $socialProfile) {
            return [
                'weekly_posts' => 0,
                'avg_engagement' => 0,
                'trending_tags' => $this->feedService->trendingTags(4),
                'last_posted' => null,
            ];
        }

        $posts = SocialPost::query()
            ->where('social_profile_id', $socialProfile->getKey())
            ->whereNotNull('published_at')
            ->where('published_at', '>=', now()->subDays(7))
            ->get(['likes_count', 'comments_count', 'shares_count', 'published_at']);

        $weeklyPosts = $posts->count();
        $avgEngagement = $weeklyPosts > 0
            ? (int) round($posts->avg(fn ($post) => ($post->likes_count ?? 0) + ($post->comments_count ?? 0) + ($post->shares_count ?? 0)))
            : 0;

        $lastPosted = $posts
            ->sortByDesc('published_at')
            ->pluck('published_at')
            ->first();

        return [
            'weekly_posts' => $weeklyPosts,
            'avg_engagement' => $avgEngagement,
            'trending_tags' => $this->feedService->trendingTags(4),
            'last_posted' => $lastPosted ? $lastPosted->diffForHumans() : Arr::get($metrics, 'last_posted_human'),
        ];
    }

    private function momentumScore(int $openMilestones, int $completedMilestones, int $weeklyPosts): int
    {
        $total = $openMilestones + $completedMilestones;
        $progressRatio = $total > 0 ? $completedMilestones / $total : 0.35;
        $progressScore = $progressRatio * 60;
        $communityScore = min($weeklyPosts * 8, 30);
        $focusBonus = $openMilestones === 0 ? 10 : max(10 - ($openMilestones * 1.5), 0);

        return (int) round(min(100, $progressScore + $communityScore + $focusBonus));
    }

    /**
     * @return string[]
     *
     * @psalm-return list<non-falsy-string>
     */
    private function recommendations(BusinessProfile $profile, Collection $metrics, array $communityPulse): array
    {
        $suggestions = [];
        $supportNeeds = collect($profile->support_needs ?? []);
        $pillars = collect($profile->focus_pillars ?? []);

        if ($supportNeeds->isNotEmpty()) {
            $suggestions[] = 'Ask the community for '.$supportNeeds->first().' this week.';
        }

        if ($pillars->isNotEmpty()) {
            $suggestions[] = 'Highlight a story about '.Str::headline($pillars->first()).' across your next post.';
        }

        if ($communityPulse['weekly_posts'] < 2) {
            $suggestions[] = 'Publish at least two updates to keep visibility high.';
        }

        $pilotPartners = (int) $metrics->get('pilot_partners', 0);
        if ($pilotPartners < 3) {
            $suggestions[] = 'Line up another pilot partner to unlock social proof.';
        }

        return array_slice($suggestions, 0, 3);
    }
}

