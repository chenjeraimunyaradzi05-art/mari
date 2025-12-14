<?php

declare(strict_types=1);

namespace Database\Factories\WomenRealEstate;

use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenListingMortgageSnapshot;
use App\Models\WomenRealEstate\WomenMortgageMarketRate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenListingMortgageSnapshot>
 */
final class WomenListingMortgageSnapshotFactory extends Factory
{
    protected $model = WomenListingMortgageSnapshot::class;

    #[\Override]
    /**
     * @return ((array|string)[]|WomenListingFactory|WomenMortgageMarketRateFactory|float|string)[]
     *
     * @psalm-return array{listing_id: WomenListingFactory, rate_id: WomenMortgageMarketRateFactory, deposit_required: float, principal_amount: float, comparison_rate: float, repayment_weekly: float, repayment_monthly: float, repayment_fortnightly: float, currency: 'AUD', ai_commentary: array{summary: string, signals: array|string}}
     */
    public function definition(): array
    {
        $principal = $this->faker->randomFloat(2, 180000, 1400000);
        $comparisonRate = $this->faker->randomFloat(3, 2.8, 6.9);

        return [
            'listing_id' => WomenListing::factory(),
            'rate_id' => WomenMortgageMarketRate::factory(),
            'deposit_required' => round($principal * $this->faker->randomFloat(2, 0.05, 0.3), 2),
            'principal_amount' => $principal,
            'comparison_rate' => $comparisonRate,
            'repayment_weekly' => $this->faker->randomFloat(2, 380, 1400),
            'repayment_monthly' => $this->faker->randomFloat(2, 1400, 5200),
            'repayment_fortnightly' => $this->faker->randomFloat(2, 760, 2600),
            'currency' => 'AUD',
            'ai_commentary' => [
                'summary' => $this->faker->sentence(),
                'signals' => $this->faker->words(nb: 3),
            ],
        ];
    }
}

