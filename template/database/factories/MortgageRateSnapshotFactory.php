<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\MortgageRateSnapshot;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

final class MortgageRateSnapshotFactory extends Factory
{
    protected $model = MortgageRateSnapshot::class;

    #[\Override]
    /**
     * @return (\DateTime|array|float|int|mixed|string)[]
     *
     * @psalm-return array{provider: string, product_name: string, rate_type: mixed, term_months: int, interest_rate: float, comparison_rate: float, apr: float, max_lvr: mixed, min_deposit_percent: mixed, available_to: mixed, market_region: 'AU', feature_flags: array, captured_at: \DateTime, source: 'womenrise.marketplace.testing'}
     */
    public function definition(): array
    {
        $provider = $this->faker->company() . ' Bank';

        return [
            'provider' => $provider,
            'product_name' => 'Empower ' . Str::title($this->faker->word()) . ' Loan',
            'rate_type' => $this->faker->randomElement(['fixed', 'variable', 'split', 'introductory']),
            'term_months' => $this->faker->numberBetween(180, 360),
            'interest_rate' => $this->faker->randomFloat(3, 3.5, 7.5),
            'comparison_rate' => $this->faker->randomFloat(3, 3.6, 7.7),
            'apr' => $this->faker->randomFloat(3, 3.6, 7.7),
            'max_lvr' => $this->faker->randomElement([80, 85, 90, 95]),
            'min_deposit_percent' => $this->faker->randomElement([5, 10, 15, 20]),
            'available_to' => $this->faker->randomElement(['owner_occupier', 'investor', 'first_home']),
            'market_region' => 'AU',
            'feature_flags' => $this->faker->randomElements([
                'women_led_service_team',
                'fee_waiver_first_year',
                'shared_equity_ready',
                'mentoring_bundle',
                'offset_account',
                'green_home_discount',
            ], $this->faker->numberBetween(1, 3)),
            'captured_at' => $this->faker->dateTimeBetween('-3 days', 'now'),
            'source' => 'womenrise.marketplace.testing',
        ];
    }
}

