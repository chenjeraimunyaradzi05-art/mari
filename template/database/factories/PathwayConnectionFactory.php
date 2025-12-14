<?php

namespace Database\Factories;

use App\Models\Pathways\PathwayConnection;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PathwayConnection>
 */
final class PathwayConnectionFactory extends Factory
{
    protected $model = PathwayConnection::class;

    #[\Override]
    /**
     * @return (int|null|string|string[])[]
     *
     * @psalm-return array{user_id: null, source_type: string, source_id: int, target_type: string, target_id: int, connection_score: int, estimated_duration_weeks: int, estimated_cost_aud: int, metadata: array{summary: string}}
     */
    public function definition(): array
    {
        $sourceType = $this->faker->randomElement([
            'job',
            'course',
            'grant',
            'housing',
            'business',
        ]);
        $targetType = $this->faker->randomElement(array_diff([
            'job',
            'course',
            'grant',
            'housing',
            'business',
        ], [$sourceType]));

        return [
            'user_id' => null,
            'source_type' => Str::studly($sourceType),
            'source_id' => $this->faker->numberBetween(1, 5000),
            'target_type' => Str::studly($targetType),
            'target_id' => $this->faker->numberBetween(1, 5000),
            'connection_score' => $this->faker->numberBetween(60, 98),
            'estimated_duration_weeks' => $this->faker->numberBetween(4, 96),
            'estimated_cost_aud' => $this->faker->numberBetween(0, 50000),
            'metadata' => [
                'summary' => $this->faker->sentence(),
            ],
        ];
    }
}

