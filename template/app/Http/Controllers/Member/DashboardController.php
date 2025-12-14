<?php

namespace App\Http\Controllers\Member;

use App\Http\Controllers\Controller;
use App\Models\CareerInterest;
use App\Models\GrantApplication;
use App\Models\OpportunityRadarEntry;
use App\Models\Pathways\PathwayMilestone;
use App\Services\Advertising\MemberDashboardPlacementService;
use App\Services\Growth\ReferralService;
use App\Services\WelcomeMessageService;
use App\Support\AthenaPillarService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class DashboardController extends Controller
{
    public function __construct(
        private WelcomeMessageService $welcomeMessages,
        private ReferralService $referralService
    )
    {
    }

    public function __invoke(
        Request $request,
        AthenaPillarService $pillarService,
        MemberDashboardPlacementService $placementService,
        \App\Services\PathwayOrchestrator $pathwayOrchestrator
    ) {
        $user = $request->user();

        $activePathways = $pathwayOrchestrator->getUserPathways($user);

        $interests = CareerInterest::query()
            ->where('user_id', $user->id)
            ->latest('updated_at')
            ->get();

        $active = $interests->where('status', 'active');

        $summary = [
            'total' => $interests->count(),
            'active' => $active->count(),
            'paused' => $interests->where('status', 'paused')->count(),
            'fulfilled' => $interests->where('status', 'fulfilled')->count(),
            'notifications_ready' => $active->filter(fn (CareerInterest $interest) => $interest->notify_in_app || $interest->notify_email)->count(),
            'notifications_muted' => $active->filter(fn (CareerInterest $interest) => ! $interest->notify_in_app && ! $interest->notify_email)->count(),
        ];

        $groupings = $this->buildGroupingSummary($active);
        $highlightCards = $this->buildHighlightCards($interests);

        $grantApplications = GrantApplication::query()
            ->with('program:id,name,slug,provider_name,closes_at')
            ->where('user_id', $user->id)
            ->latest('updated_at')
            ->get();

        $grantSummary = [
            'total' => $grantApplications->count(),
            'drafts' => $grantApplications->where('status', 'draft')->count(),
            'ready' => $grantApplications->where('ready_for_review', true)->count(),
            'submitted' => $grantApplications->where('status', 'submitted')->count(),
        ];

        $grantCards = $this->buildGrantCards($grantApplications);

        $memberSignals = [
            'pathway_types' => $interests->pluck('pathway_type')->filter()->unique()->values()->all(),
            'industries' => $interests->pluck('industry')->filter()->unique()->values()->all(),
            'preferred_locations' => $interests->pluck('preferred_location')->filter()->unique()->values()->all(),
            'grant_statuses' => $grantApplications->pluck('status')->filter()->unique()->values()->all(),
        ];

        $advertisingPlacements = $placementService->placementsFor($user, $memberSignals);

        $radarEntries = OpportunityRadarEntry::where('user_id', $user->id)
            ->orderByDesc('score')
            ->take(5)
            ->get();

        $welcome = $this->welcomeMessages->buildPayload($user, $interests);

        if ($user->first_login) {
            $user->forceFill(['first_login' => false])->save();
        }

        $referralCode = $this->referralService->generateReferralCode($user);
        $referralLink = route('register', ['ref' => $referralCode]);

        // New: Quick Actions
        $quickActions = [
            [
                'label' => 'Personal Dashboard',
                'url' => route('member.personal.dashboard'),
                'icon' => 'user-circle',
                'description' => 'Manage your profile & media'
            ],
            [
                'label' => 'Find Grants',
                'url' => route('grants.index'),
                'icon' => 'currency-dollar',
                'description' => 'Search for funding'
            ],
            [
                'label' => 'Explore Pathways',
                'url' => route('member.pathways.index'),
                'icon' => 'map',
                'description' => 'Plan your next move'
            ],
            [
                'label' => 'Career Wishlist',
                'url' => route('careers.wishlist'),
                'icon' => 'heart',
                'description' => 'Manage your dream roles'
            ],
        ];

        // New: Impact Stats (Mocked for now based on available data)
        $completedMilestones = PathwayMilestone::whereHas('phase.pathway', function ($query) use ($user) {
            $query->where('user_id', $user->id);
        })->where('status', 'completed')->count();

        $impactStats = [
            'milestones_completed' => $completedMilestones,
            'pathways_active' => $activePathways->count(),
            'grants_submitted' => $grantSummary['submitted'],
            'impact_score' => 0, // Placeholder for future calculation
        ];

        return view('dashboard', [
            'welcome' => $welcome,
            'summary' => $summary,
            'groupings' => $groupings,
            'highlightCards' => $highlightCards,
            'hasInterests' => $interests->isNotEmpty(),
            'wishlistUrl' => route('careers.wishlist'),
            'grantsUrl' => route('grants.index'),
            'grantSummary' => $grantSummary,
            'grantCards' => $grantCards,
            'microPanels' => $pillarService->microPanels(),
            'charterHighlights' => $pillarService->charterHighlights(),
            'adPlacements' => $advertisingPlacements,
            'radarEntries' => $radarEntries,
            'referralLink' => $referralLink,
            'activePathways' => $activePathways,
            'quickActions' => $quickActions,
            'impactStats' => $impactStats,
        ]);
    }

    /**
     * @return (int|string)[][]
     *
     * @psalm-return list{array{label: 'Jobs & trades', count: int, description: 'Roles, apprenticeships, and trades we are pre-warming.'}, array{label: 'TAFE & uni', count: int, description: 'Study pathways, bridging programs, and course intakes.'}, array{label: 'Public sector & other', count: int, description: 'Government pipelines, scholarships, or bespoke pathways.'}}
     */
    private function buildGroupingSummary(Collection $active): array
    {
        // Buckets mirror the priority pathways described in the roadmap (jobs/trades, study, public sector/other).
        return [
            [
                'label' => 'Jobs & trades',
                'count' => $active->whereIn('pathway_type', ['job', 'trade', 'apprenticeship', 'traineeship'])->count(),
                'description' => 'Roles, apprenticeships, and trades we are pre-warming.',
            ],
            [
                'label' => 'TAFE & uni',
                'count' => $active->whereIn('pathway_type', ['tafe_course', 'university_course'])->count(),
                'description' => 'Study pathways, bridging programs, and course intakes.',
            ],
            [
                'label' => 'Public sector & other',
                'count' => $active->whereIn('pathway_type', ['public_sector', 'other'])->count(),
                'description' => 'Government pipelines, scholarships, or bespoke pathways.',
            ],
        ];
    }

    /**
     * @return (\Illuminate\Support\Carbon|bool|int|null|string)[][]
     *
     * @psalm-return array<int, array{id: int, title: string, type_label: string, status: string, location: string, timeline: string, match_count: int, last_matched_at: \Illuminate\Support\Carbon|null, notify_in_app: bool, notify_email: bool, summary: string}>
     */
    private function buildHighlightCards(Collection $interests): array
    {
        return $interests
            ->sortByDesc(fn (CareerInterest $interest) => $interest->last_matched_at?->timestamp ?? $interest->updated_at?->timestamp ?? $interest->created_at?->timestamp ?? 0)
            ->take(4)
            ->map(function (CareerInterest $interest) {
                return [
                    'id' => $interest->id,
                    'title' => $this->deriveTitle($interest),
                    'type_label' => $this->formatTypeLabel($interest->pathway_type),
                    'status' => $interest->status,
                    'location' => $interest->preferred_location ?: ($interest->open_to_remote ? 'Open to remote / hybrid' : 'Flexible location'),
                    'timeline' => $interest->timeline ?: ($interest->intake_window ?: 'Anytime'),
                    'match_count' => (int) $interest->match_count,
                    'last_matched_at' => $interest->last_matched_at,
                    'notify_in_app' => (bool) $interest->notify_in_app,
                    'notify_email' => (bool) $interest->notify_email,
                    'summary' => $this->summariseFocus($interest),
                ];
            })
            ->values()
            ->all();
    }

    private function deriveTitle(CareerInterest $interest): string|null
    {
        if (filled($interest->title)) {
            return $interest->title;
        }

        return Str::headline(str_replace('_', ' ', (string) $interest->pathway_type));
    }

    private function formatTypeLabel(?string $pathwayType): string
    {
        return match ($pathwayType) {
            'job' => 'Dream role',
            'trade' => 'Trade pathway',
            'apprenticeship' => 'Apprenticeship',
            'traineeship' => 'Traineeship',
            'tafe_course' => 'TAFE / VET pathway',
            'university_course' => 'University pathway',
            'public_sector' => 'Public sector stream',
            default => 'Exploration',
        };
    }

    private function summariseFocus(CareerInterest $interest): string
    {
        $parts = collect([
            $interest->field,
            $interest->industry,
            $interest->level,
        ])->filter()->values();

        if (is_array($interest->target_roles) && filled($interest->target_roles)) {
            $parts->push('Roles: '.implode(', ', array_slice($interest->target_roles, 0, 2)));
        }

        if (is_array($interest->preferred_study_modes) && filled($interest->preferred_study_modes)) {
            $parts->push('Modes: '.implode(', ', array_slice($interest->preferred_study_modes, 0, 2)));
        }

        return $parts->take(3)->implode(' · ');
    }

    /**
     * @return (\Illuminate\Support\Carbon|bool|int|null|string)[][]
     *
     * @psalm-return array<int, array{id: int, program_name: string, provider: null|string, status: string, ready_for_review: bool, progress_percent: int, documents: int<0, max>, closes_at: \Illuminate\Support\Carbon|null, submitted_at: \Illuminate\Support\Carbon|null, last_touched_at: \Illuminate\Support\Carbon|null, details_url: string, apply_url: string}>
     */
    private function buildGrantCards(Collection $applications): array
    {
        return $applications
            ->sortByDesc(fn (GrantApplication $application) => $application->submitted_at?->timestamp ?? $application->updated_at?->timestamp ?? 0)
            ->take(4)
            ->map(function (GrantApplication $application) {
                $program = $application->program;

                return [
                    'id' => $application->id,
                    'program_name' => $program?->name ?? 'Grant program',
                    'provider' => $program?->provider_name,
                    'status' => $application->status,
                    'ready_for_review' => (bool) $application->ready_for_review,
                    'progress_percent' => (int) $application->progress_percent,
                    'documents' => is_array($application->documents) ? count($application->documents) : 0,
                    'closes_at' => $program?->closes_at,
                    'submitted_at' => $application->submitted_at,
                    'last_touched_at' => $application->submitted_at ?? $application->updated_at,
                    'details_url' => $program ? route('grants.show', $program) : route('grants.index'),
                    'apply_url' => $program ? route('grants.apply', $program) : route('grants.index'),
                ];
            })
            ->values()
            ->all();
    }
}

