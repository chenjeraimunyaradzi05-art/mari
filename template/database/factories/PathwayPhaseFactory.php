<?php

namespace Database\Factories;

use App\Models\Pathways\LifePathway;
use App\Models\Pathways\PathwayPhase;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PathwayPhase>
 */
final class PathwayPhaseFactory extends Factory
{
    protected $model = PathwayPhase::class;

    #[\Override]
    /**
     * @return (Pathways\LifePathwayFactory|int|int[]|mixed|string)[]
     *
     * @psalm-return array{life_pathway_id: Pathways\LifePathwayFactory, sequence: int, title: string, description: string, estimated_duration_weeks: int, estimated_cost_aud: int, readiness_state: mixed, mentor_type: mixed, support_level: mixed, impact_weight: int, dependencies: array<never, never>, metadata: array{kpi: int}}
     */
    public function definition(): array
    {
        return [
            'life_pathway_id' => LifePathway::factory(),
            'sequence' => $this->faker->unique()->numberBetween(1, 5),
            'title' => $this->faker->sentence(3),
            'description' => $this->faker->paragraph(),
            'estimated_duration_weeks' => $this->faker->numberBetween(4, 24),
            'estimated_cost_aud' => $this->faker->numberBetween(500, 15000),
            'readiness_state' => $this->faker->randomElement(['planned', 'in_progress', 'complete']),
            'mentor_type' => $this->faker->randomElement(['Mentor', 'Advisor', 'Community']),
            'support_level' => $this->faker->randomElement(['high', 'medium', 'low']),
            'impact_weight' => $this->faker->numberBetween(10, 40),
            'dependencies' => [],
            'metadata' => ['kpi' => $this->faker->numberBetween(1, 100)],
        ];
    }
}
