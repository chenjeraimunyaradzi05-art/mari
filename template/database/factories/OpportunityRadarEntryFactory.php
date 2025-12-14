<?php

namespace Database\Factories;

use App\Models\OpportunityRadarEntry;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OpportunityRadarEntry>
 */
final class OpportunityRadarEntryFactory extends Factory
{
    protected $model = OpportunityRadarEntry::class;

    #[\Override]
    /**
     * @return (UserFactory|\Illuminate\Support\Carbon|array|int|mixed|string)[]
     *
     * @psalm-return array{user_id: UserFactory, opportunity_type: mixed, opportunity_id: int, title: string, subtitle: string, summary: string, score: int, urgency_level: mixed, fit_reasons: array, action_url: string, expires_at: \Illuminate\Support\Carbon}
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'opportunity_type' => $this->faker->randomElement(['job', 'grant', 'housing']),
            'opportunity_id' => $this->faker->numberBetween(1, 1000),
            'title' => $this->faker->sentence(4),
            'subtitle' => $this->faker->sentence(6),
            'summary' => $this->faker->paragraph(),
            'score' => $this->faker->numberBetween(55, 99),
            'urgency_level' => $this->faker->randomElement(['urgent', 'accelerate', 'steady']),
            'fit_reasons' => $this->faker->randomElements([
                'matches_salary_expectation',
                'close_to_location',
                'aligned_with_interest',
            ], 2),
            'action_url' => $this->faker->url(),
            'expires_at' => now()->addDays($this->faker->numberBetween(3, 21)),
        ];
    }
}
