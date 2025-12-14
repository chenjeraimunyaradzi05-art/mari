<?php

namespace Database\Factories;

use App\Models\Pathways\LifePathway;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LifePathway>
 */
final class LifePathwayFactory extends Factory
{
    protected $model = LifePathway::class;

    #[\Override]
    /**
     * @return (UserFactory|array|int|mixed|string)[]
     *
     * @psalm-return array{user_id: UserFactory, title: string, goal_key: mixed, status: mixed, summary: string, confidence_score: int, impact_score: int, total_duration_weeks: int, total_cost_aud: int, urgency_label: mixed, focus_areas: array, ai_context: array{prompt_version: 'v1'}, metrics: array{momentum: int}}
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'title' => $this->faker->sentence(4),
            'goal_key' => $this->faker->randomElement(['start_business', 'become_electrician', 'secure_housing']),
            'status' => $this->faker->randomElement(['draft', 'active', 'on_hold']),
            'summary' => $this->faker->paragraph(),
            'confidence_score' => $this->faker->numberBetween(55, 95),
            'impact_score' => $this->faker->numberBetween(40, 90),
            'total_duration_weeks' => $this->faker->numberBetween(12, 104),
            'total_cost_aud' => $this->faker->numberBetween(1000, 40000),
            'urgency_label' => $this->faker->randomElement(['steady', 'accelerate', 'urgent']),
            'focus_areas' => $this->faker->randomElements([
                'income', 'housing', 'education', 'wellbeing', 'business',
            ], 2),
            'ai_context' => ['prompt_version' => 'v1'],
            'metrics' => ['momentum' => $this->faker->numberBetween(50, 100)],
        ];
    }
}

