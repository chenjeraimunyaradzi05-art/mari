<?php

namespace Database\Factories;

use App\Models\AIClientAlert;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AIClientAlert>
 */
final class AIClientAlertFactory extends Factory
{
    protected $model = AIClientAlert::class;

    #[\Override]
    /**
     * @return (\Illuminate\Support\Carbon|int[]|mixed|null|string)[]
     *
     * @psalm-return array{source: string, severity: mixed, message: string, context: array{code: int}, admin_id: null, ip: string, user_agent: 'phpunit', received_at: \Illuminate\Support\Carbon}
     */
    public function definition(): array
    {
        return [
            'source' => $this->faker->unique()->lexify('alert_????'),
            'severity' => $this->faker->randomElement(['info', 'warning', 'error', 'critical']),
            'message' => $this->faker->sentence(),
            'context' => ['code' => $this->faker->randomDigitNotNull()],
            'admin_id' => null,
            'ip' => $this->faker->ipv4(),
            'user_agent' => 'phpunit',
            'received_at' => now(),
        ];
    }

    public function acknowledged(): static
    {
        return $this->state(function () {
            return [
                'acknowledged_at' => now(),
            ];
        });
    }
}
