<?php

namespace Database\Factories;

use App\Models\ImpactIndexSnapshot;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ImpactIndexSnapshot>
 */
final class ImpactIndexSnapshotFactory extends Factory
{
    protected $model = ImpactIndexSnapshot::class;

    #[\Override]
    /**
     * @return (\Illuminate\Support\Carbon|int[]|string|true)[]
     *
     * @psalm-return array{timeframe: 'daily', snapshot_date: string, metrics: array{total_members: int, jobs_secured: int, income_uplift_aud: int, housing_transitions: int, bundle_savings_aud: int}, is_public: true, published_at: \Illuminate\Support\Carbon}
     */
    public function definition(): array
    {
        return [
            'timeframe' => 'daily',
            'snapshot_date' => now()->toDateString(),
            'metrics' => [
                'total_members' => $this->faker->numberBetween(1000, 1000000),
                'jobs_secured' => $this->faker->numberBetween(100, 100000),
                'income_uplift_aud' => $this->faker->numberBetween(1000000, 100000000),
                'housing_transitions' => $this->faker->numberBetween(50, 10000),
                'bundle_savings_aud' => $this->faker->numberBetween(50000, 5000000),
            ],
            'is_public' => true,
            'published_at' => now(),
        ];
    }
}
