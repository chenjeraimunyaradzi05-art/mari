<?php

namespace Database\Factories;

use App\Models\BusinessCashbook;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\BusinessCashbook>
 */
final class BusinessCashbookFactory extends Factory
{
    protected $model = BusinessCashbook::class;

    #[\Override]
    /**
     * @return (UserFactory|\Illuminate\Support\Carbon|array|false|string)[]
     *
     * @psalm-return array{user_id: UserFactory, name: string, entity_type: 'sole_trader', currency: 'AUD', is_default: false, start_date: \Illuminate\Support\Carbon, notes: string, metadata: array<never, never>}
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => $this->faker->company.' Cashbook',
            'entity_type' => 'sole_trader',
            'currency' => 'AUD',
            'is_default' => false,
            'start_date' => now()->subMonths(3),
            'notes' => $this->faker->sentence(),
            'metadata' => [],
        ];
    }

    /**
     * Mark the generated cashbook as the user's default cashbook.
     *
     * @return $this
     */
    public function default(): static
    {
        return $this->state(fn () => ['is_default' => true]);
    }
}
