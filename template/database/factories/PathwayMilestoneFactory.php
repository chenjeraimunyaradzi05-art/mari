<?php

namespace Database\Factories;

use App\Models\Pathways\PathwayMilestone;
use App\Models\Pathways\PathwayPhase;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PathwayMilestone>
 */
final class PathwayMilestoneFactory extends Factory
{
    protected $model = PathwayMilestone::class;

    #[\Override]
    /**
     * @return (Pathways\PathwayPhaseFactory|\Illuminate\Support\Carbon|int|mixed|null|string|string[])[]
     *
     * @psalm-return array{pathway_phase_id: Pathways\PathwayPhaseFactory, sequence: int, title: string, description: string, due_on: \Illuminate\Support\Carbon, status: mixed, progress: int, blockers: null|string, metadata: array{owner: string}}
     */
    public function definition(): array
    {
        return [
            'pathway_phase_id' => PathwayPhase::factory(),
            'sequence' => $this->faker->unique()->numberBetween(1, 6),
            'title' => $this->faker->sentence(3),
            'description' => $this->faker->sentence(12),
            'due_on' => now()->addWeeks($this->faker->numberBetween(2, 24)),
            'status' => $this->faker->randomElement(['planned', 'in_progress', 'complete']),
            'progress' => $this->faker->numberBetween(0, 100),
            'blockers' => $this->faker->boolean(20) ? $this->faker->sentence() : null,
            'metadata' => ['owner' => $this->faker->firstName()],
        ];
    }
}

