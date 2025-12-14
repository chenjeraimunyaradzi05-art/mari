<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Enums\WomenRealEstate\CohortPersona;
use App\Enums\WomenRealEstate\CohortRole;
use App\Enums\WomenRealEstate\CohortStatus;
use App\Enums\WomenRealEstate\GoalType;
use App\Enums\WomenRealEstate\PartnerMatchStatus;
use App\Models\User;
use App\Models\WomenRealEstate\WomenCohortEnrolment;
use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Models\WomenRealEstate\WomenDashboardPreference;
use App\Models\WomenRealEstate\WomenDashboardWidget;
use App\Models\WomenRealEstate\WomenGoalTracker;
use App\Models\WomenRealEstate\WomenPartnerMatch;
use Illuminate\Support\Facades\DB;

final class WomenCohortService
{
    public function createProfileForUser(User $user, CohortPersona $persona, array $payload = []): WomenCohortProfile
    {
        return DB::transaction(function () use ($user, $persona, $payload) {
            $profile = WomenCohortProfile::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'persona' => $persona->value,
                    'financial_profile' => $payload['financial_profile'] ?? null,
                    'education_profile' => $payload['education_profile'] ?? null,
                    'ai_insights' => $payload['ai_insights'] ?? null,
                    'preferences' => $payload['preferences'] ?? null,
                ]
            );

            $this->ensureDashboardPreferences($user, $persona, $payload['dashboard'] ?? []);

            return $profile;
        });
    }

    public function enrolProfile(WomenCohortProfile $profile, string $cohortSlug, CohortRole $role): WomenCohortEnrolment
    {
        return WomenCohortEnrolment::updateOrCreate(
            [
                'profile_id' => $profile->id,
                'cohort_slug' => $cohortSlug,
            ],
            [
                'role' => $role->value,
                'status' => CohortStatus::ACTIVE->value,
                'joined_at' => now(),
                'left_at' => null,
            ]
        );
    }

    public function recordGoalProgress(WomenCohortProfile $profile, GoalType $goalType, float $currentAmount): WomenGoalTracker
    {
        $tracker = WomenGoalTracker::firstOrCreate(
            [
                'profile_id' => $profile->id,
                'goal_type' => $goalType->value,
            ],
            [
                'target_amount' => $currentAmount * 1.2,
                'current_amount' => 0,
                'progress_percent' => 0,
            ]
        );

        $tracker->updateProgress($currentAmount);

        return $tracker;
    }

    public function acceptPartnerIntro(WomenPartnerMatch $match): WomenPartnerMatch
    {
    $match->status = PartnerMatchStatus::IN_DISCUSSION;
        $match->save();

        return $match;
    }

    private function ensureDashboardPreferences(User $user, CohortPersona $persona, array $overrides): WomenDashboardPreference
    {
        $preference = WomenDashboardPreference::firstOrCreate(
            ['user_id' => $user->id],
            [
                'persona' => $persona->value,
                'layout' => $this->defaultLayout($persona),
                'settings' => [
                    'theme' => 'light',
                    'notifications' => ['email' => true, 'push' => false],
                ],
            ]
        );

        if ($overrides !== []) {
            $preference->layout = $overrides['layout'] ?? $preference->layout;
            $preference->settings = array_merge($preference->settings ?? [], $overrides['settings'] ?? []);
            $preference->save();
        }

        if (! $preference->relationLoaded('widgets')) {
            $preference->load('widgets');
        }

        if ($preference->widgets->isEmpty()) {
            $this->seedDefaultWidgets($preference, $persona);
        }

        return $preference;
    }

    /**
     * @return (string|string[])[]
     *
     * @psalm-return array{grid: 'single-column'|'three-column'|'two-column', order: list{0: 'hero_summary', 1: string, 2: string, 3?: 'ai_nudges'|'mortgage_widget'}}
     */
    private function defaultLayout(CohortPersona $persona): array
    {
        return match ($persona) {
            CohortPersona::LEARNER => [
                'grid' => 'two-column',
                'order' => ['hero_summary', 'goal_tracker', 'mentor_matches', 'mortgage_widget'],
            ],
            CohortPersona::FIRST_HOME_BUYER => [
                'grid' => 'two-column',
                'order' => ['hero_summary', 'mortgage_widget', 'recommended_listings', 'ai_nudges'],
            ],
            CohortPersona::INVESTOR, CohortPersona::DEVELOPER => [
                'grid' => 'three-column',
                'order' => ['hero_summary', 'partner_opportunities', 'goal_tracker', 'ai_nudges'],
            ],
            CohortPersona::MENTOR => [
                'grid' => 'single-column',
                'order' => ['hero_summary', 'mentor_matches', 'ai_nudges'],
            ],
        };
    }

    private function seedDefaultWidgets(WomenDashboardPreference $preference, CohortPersona $persona): void
    {
        $widgetMap = match ($persona) {
            CohortPersona::LEARNER => ['hero_summary', 'mortgage_widget', 'goal_tracker', 'mentor_matches'],
            CohortPersona::FIRST_HOME_BUYER => ['hero_summary', 'mortgage_widget', 'recommended_listings', 'goal_tracker'],
            CohortPersona::INVESTOR, CohortPersona::DEVELOPER => ['hero_summary', 'partner_opportunities', 'goal_tracker', 'ai_nudges'],
            CohortPersona::MENTOR => ['hero_summary', 'mentor_matches', 'ai_nudges'],
        };

        foreach ($widgetMap as $index => $widget) {
            WomenDashboardWidget::create([
                'preference_id' => $preference->id,
                'widget' => $widget,
                'position' => $index + 1,
                'pinned' => $index <= 1,
                'config' => ['persona' => $persona->value],
            ]);
        }
    }
}

