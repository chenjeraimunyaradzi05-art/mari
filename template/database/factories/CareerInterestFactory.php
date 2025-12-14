<?php

namespace Database\Factories;

use App\Models\CareerInterest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\CareerInterest>
 */
final class CareerInterestFactory extends Factory
{
    protected $model = CareerInterest::class;

    #[\Override]
    /**
     * @return (UserFactory|\Illuminate\Support\Carbon|bool|int|mixed|string|string[])[]
     *
     * @psalm-return array{user_id: UserFactory, pathway_type: mixed, title: string, target_roles: list{'Team Lead', 'Coordinator'}, target_sectors: list{'STEM', 'Public sector'}, field: mixed, industry: mixed, level: mixed, preferred_location: string, preferred_locations_multi: list{string, string}, preferred_study_modes: list{'online', 'hybrid'}, open_to_remote: bool, min_pay_annual: 65000, max_pay_annual: 90000, timeline: '0-3 months', intake_window: 'Ready from Term 2, 2026', skills: 'Leadership, stakeholder management', notes: 'Needs flexible rostering.', support_needs: 'Scholarship support', status: 'active', notify_in_app: true, notify_email: false, is_active: true, last_matched_at: \Illuminate\Support\Carbon, match_count: 3}
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'pathway_type' => $this->faker->randomElement([
                'job',
                'trade',
                'apprenticeship',
                'traineeship',
                'tafe_course',
                'university_course',
                'public_sector',
                'other',
            ]),
            'title' => $this->faker->jobTitle(),
            'target_roles' => ['Team Lead', 'Coordinator'],
            'target_sectors' => ['STEM', 'Public sector'],
            'field' => $this->faker->randomElement(['Cyber security', 'Nursing', 'Construction']),
            'industry' => $this->faker->randomElement(['Technology', 'Healthcare', 'Trades']),
            'level' => $this->faker->randomElement(['Entry', 'Mid', 'Senior']),
            'preferred_location' => $this->faker->city(),
            'preferred_locations_multi' => [$this->faker->city(), $this->faker->city()],
            'preferred_study_modes' => ['online', 'hybrid'],
            'open_to_remote' => $this->faker->boolean(),
            'min_pay_annual' => 65000,
            'max_pay_annual' => 90000,
            'timeline' => '0-3 months',
            'intake_window' => 'Ready from Term 2, 2026',
            'skills' => 'Leadership, stakeholder management',
            'notes' => 'Needs flexible rostering.',
            'support_needs' => 'Scholarship support',
            'status' => 'active',
            'notify_in_app' => true,
            'notify_email' => false,
            'is_active' => true,
            'last_matched_at' => now()->subDays(2),
            'match_count' => 3,
        ];
    }
}
