<?php

declare(strict_types=1);

namespace App\Livewire\Cohorts;

use App\Enums\WomenRealEstate\CohortPersona;
use App\Enums\WomenRealEstate\DashboardWidgetType;
use App\Models\User;
use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Models\WomenRealEstate\WomenDashboardPreference;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenPartnerProject;
use App\Services\WomenRealEstate\GoalTrackingService;
use App\Services\WomenRealEstate\MentorshipMatchingService;
use App\Services\WomenRealEstate\MortgageGuidanceService;
use App\Services\WomenRealEstate\WomenCohortService;
use App\Services\WomenRealEstate\WomenDashboardService;
use App\Services\WomenRealEstate\WomenPartnerMatchingService;
use App\Support\Livewire\FallbackComponent;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

trait DashboardBehavior
{
    public string $persona = 'first_home_buyer';

    public int $profileId = 0;

    public array $hero = [];

    public array $quickActions = [];

    public array $widgets = [];

    public array $modules = [];

    private WomenCohortProfile $profile;

    private WomenDashboardPreference $preference;

    public function mount(
        string $persona,
        WomenDashboardService $dashboardService,
        WomenCohortService $cohortService,
        GoalTrackingService $goalTrackingService,
        MortgageGuidanceService $mortgageGuidanceService,
        MentorshipMatchingService $mentorshipMatchingService,
        WomenPartnerMatchingService $partnerMatchingService
    ): void {
        $this->persona = $this->resolvePersona($persona)->value;

        $user = $this->guardedUser();

        $this->profile = $this->ensureProfile($user, $cohortService);
        $this->profileId = $this->profile->id;
        $this->preference = $this->ensurePreference($user, $dashboardService, $cohortService);

        $goalSummary = $goalTrackingService->summary($this->profile);

        $this->hero = $this->buildHeroSummary($goalSummary);
        $this->quickActions = $this->buildQuickActions($goalSummary);

        $this->modules = [
            DashboardWidgetType::GOAL_TRACKER->value => $goalSummary,
            DashboardWidgetType::MORTGAGE_WIDGET->value => $mortgageGuidanceService->insight($this->profile, $goalSummary),
            DashboardWidgetType::MENTOR_MATCHES->value => $mentorshipMatchingService->recommendations($this->profile),
            DashboardWidgetType::PARTNER_OPPORTUNITIES->value => $this->partnerOpportunities($partnerMatchingService),
            DashboardWidgetType::RECOMMENDED_LISTINGS->value => $this->recommendedListings(),
            DashboardWidgetType::AI_NUDGES->value => $this->aiNudges($goalSummary),
        ];

        $this->widgets = $this->preference
            ->widgets
            ->sortBy('position')
            ->filter(fn ($widget) => $widget->widget !== DashboardWidgetType::HERO_SUMMARY)
            ->map(fn ($widget) => [
                'type' => $widget->widget->value,
                'label' => $widget->widget->label(),
                'pinned' => $widget->pinned,
            ])
            ->values()
            ->all();
    }

    public function render()
    {
        return view('livewire.cohorts.dashboard');
    }

    private function resolvePersona(string $persona): CohortPersona
    {
        return CohortPersona::tryFrom($persona) ?? CohortPersona::FIRST_HOME_BUYER;
    }

    private function guardedUser(): Authenticatable|User
    {
        $user = Auth::user();

        if (! $user instanceof User) {
            throw new \RuntimeException('Women dashboard requires an authenticated user.');
        }

        return $user;
    }

    private function ensureProfile(User $user, WomenCohortService $cohortService): WomenCohortProfile
    {
        $persona = $this->resolvePersona($this->persona);

        $profile = WomenCohortProfile::query()->where('user_id', $user->id)->first();

        if ($profile === null) {
            $profile = $cohortService->createProfileForUser($user, $persona);
        } else {
            if ($profile->persona !== $persona) {
                $profile->persona = $persona;
                $profile->save();
            }

            $profile = $cohortService->createProfileForUser($user, $persona, [
                'financial_profile' => $profile->financial_profile,
                'education_profile' => $profile->education_profile,
                'ai_insights' => $profile->ai_insights,
                'preferences' => $profile->preferences,
            ]);
        }

        return $profile->fresh(['goalTrackers', 'partnerMatches.project']);
    }

    private function ensurePreference(User $user, WomenDashboardService $dashboardService, WomenCohortService $cohortService): WomenDashboardPreference
    {
        $preference = $dashboardService->preferenceForUser($user);

        if ($preference instanceof WomenDashboardPreference) {
            return $preference;
        }

        $profile = $this->profile ?? $this->ensureProfile($user, $cohortService);
        $cohortService->createProfileForUser($user, $profile->persona, [
            'financial_profile' => $profile->financial_profile,
            'education_profile' => $profile->education_profile,
            'ai_insights' => $profile->ai_insights,
            'preferences' => $profile->preferences,
        ]);

        $fresh = $dashboardService->preferenceForUser($user);
        if (! $fresh instanceof WomenDashboardPreference) {
            throw new \RuntimeException('Unable to resolve dashboard preferences for user.');
        }

        return $fresh;
    }

    private function buildHeroSummary(array $goalSummary): array
    {
        $persona = $this->resolvePersona($this->persona);
        $readiness = (float) ($this->profile->ai_insights['readiness_score'] ?? $goalSummary['overall_progress'] ?? 62);
        $primaryGoal = $goalSummary['primary_goal'] ?? null;

        $savingsPercent = (float) ($primaryGoal['progress'] ?? ($goalSummary['overall_progress'] ?? 0));
        $savingsCurrent = (float) ($primaryGoal['current'] ?? 0);
        $savingsTarget = (float) ($primaryGoal['target'] ?? 1);

        return [
            'persona' => $persona->label(),
            'headline' => match ($persona) {
                CohortPersona::LEARNER => 'Your study-to-home pathway is taking shape. Keep building momentum!',
                CohortPersona::INVESTOR => 'Opportunities are lining up—review new partner pitches this week.',
                CohortPersona::DEVELOPER => 'Pipeline visibility is strong. Check project readiness before next sprint.',
                default => 'Your first-home journey is on track—time to solidify those next steps!',
            },
            'readiness_score' => round($readiness),
            'savings' => [
                'current' => round($savingsCurrent, 2),
                'target' => round($savingsTarget, 2),
                'percent' => $savingsTarget > 0 ? round(($savingsCurrent / $savingsTarget) * 100, 1) : 0.0,
            ],
            'next_milestone' => $goalSummary['upcoming_due'] ?? null,
            'ai_tip' => Arr::get($this->profile->ai_insights, 'priority_actions.summary')
                ?? 'Schedule a 15-minute review to confirm your savings plan and mentor check-ins.',
        ];
    }

    private function buildQuickActions(array $goalSummary): array
    {
        $persona = $this->resolvePersona($this->persona);
        $actions = [];

        $primaryProgress = (float) Arr::get($goalSummary, 'primary_goal.progress', 0);

        if ($primaryProgress < 50) {
            $actions[] = 'Top up your savings goal with an automated weekly transfer.';
        }

        $actions[] = match ($persona) {
            CohortPersona::LEARNER => 'Browse student-friendly listings near your campus.',
            CohortPersona::INVESTOR => 'Review partner projects flagged for due diligence.',
            CohortPersona::DEVELOPER => 'Upload your latest project pro forma for AI review.',
            default => 'Check grant eligibility before your next pre-approval step.',
        };

        if (! empty($this->profile->preferences['communication_channels'] ?? [])) {
            $actions[] = 'Update your dashboard preferences to personalise alerts.';
        }

        return $actions;
    }

    private function partnerOpportunities(WomenPartnerMatchingService $partnerMatchingService): array
    {
        $persona = $this->resolvePersona($this->persona);

        if (! in_array($persona, [CohortPersona::INVESTOR, CohortPersona::DEVELOPER], true)) {
            return [];
        }

        $projects = WomenPartnerProject::query()
            ->active()
            ->with('owner')
            ->latest()
            ->limit(4)
            ->get();

        return $projects
            ->map(function (WomenPartnerProject $project) use ($partnerMatchingService) {
                $bestMatch = $partnerMatchingService->recommendMatches($project)->first();
                $insights = is_array($bestMatch) ? ($bestMatch['insights'] ?? []) : [];
                $score = is_array($bestMatch) ? (float) ($bestMatch['score'] ?? 68.0) : 68.0;

                return [
                    'title' => $project->title,
                    'status' => Str::headline($project->status?->value ?? 'seeking partners'),
                    'owner' => $project->owner?->name ?? 'WomenRise member',
                    'summary' => Str::limit((string) $project->summary, 140),
                    'launch_at' => optional($project->target_launch_at)->toDateString(),
                    'match_estimate' => round($score, 1),
                    'ai_summary' => Arr::get($insights, 'summary'),
                    'activation_steps' => Arr::get($insights, 'activation_steps', []),
                    'values_alignment' => Arr::get($insights, 'values_alignment', []),
                    'ai_provider' => Arr::get($insights, 'provider'),
                ];
            })
            ->all();
    }

    private function recommendedListings(): array
    {
        $persona = $this->resolvePersona($this->persona);

        $audience = match ($persona) {
            CohortPersona::LEARNER => 'students',
            CohortPersona::INVESTOR, CohortPersona::DEVELOPER => 'investors',
            default => 'first_home_buyers',
        };

        $listings = WomenListing::query()
            ->published()
            ->where('primary_audience', $audience)
            ->orderByDesc('trust_score')
            ->limit(4)
            ->get(['id', 'title', 'slug', 'summary', 'price', 'currency', 'trust_score', 'market_score', 'ai_insights']);

        return $listings->map(function (WomenListing $listing) {
            if (Route::has('women.real-estate.listings.show')) {
                $url = route('women.real-estate.listings.show', $listing);
            } else {
                $url = url('/women/listings/'.$listing->slug);
            }

            return [
                'title' => $listing->title,
                'summary' => Str::limit((string) $listing->summary, 120),
                'price' => $listing->price,
                'currency' => $listing->currency,
                'trust_score' => $listing->trust_score,
                'market_score' => $listing->market_score,
                'insight' => Arr::get($listing->ai_insights, 'headline'),
                'url' => $url,
            ];
        })->all();
    }

    private function aiNudges(array $goalSummary): array
    {
        $nudges = [];

        foreach ($goalSummary['goals'] ?? [] as $goal) {
            if (! empty($goal['ai_nudges'])) {
                $nudges = array_merge($nudges, array_filter($goal['ai_nudges']));
            }
        }

        if ($nudges === []) {
            $nudges[] = 'Consistent fortnightly deposits of $250 will keep you on track for pre-approval in six months.';
        }

        return $nudges;
    }
}

if (! class_exists(__NAMESPACE__.'\\LivewireComponent', false)) {
    if (class_exists('Livewire\\Component')) {
        class_alias('Livewire\\Component', __NAMESPACE__.'\\LivewireComponent');
    } else {
        class LivewireComponent extends FallbackComponent
        {
        }
    }
}

final class Dashboard extends LivewireComponent
{
    use DashboardBehavior;
}

