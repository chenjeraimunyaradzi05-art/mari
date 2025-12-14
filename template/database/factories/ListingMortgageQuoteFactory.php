<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\ListingMortgageQuote;
use App\Models\MortgageRateSnapshot;
use App\Models\User;
use App\Models\WomenHousingListing;
use Illuminate\Database\Eloquent\Factories\Factory;

final class ListingMortgageQuoteFactory extends Factory
{
    protected $model = ListingMortgageQuote::class;

    #[\Override]
    /**
     * @return (MortgageRateSnapshotFactory|UserFactory|WomenHousingListingFactory|\DateTime|int|mixed|null|string)[]
     *
     * @psalm-return array{women_housing_listing_id: WomenHousingListingFactory, user_id: UserFactory, mortgage_rate_snapshot_id: MortgageRateSnapshotFactory, principal_amount_cents: int, deposit_amount_cents: int|null, loan_term_months: int, repayment_frequency: mixed, calculated_repayment_cents: int, risk_rating: mixed, ai_commentary: string, generated_at: \DateTime}
     */
    public function definition(): array
    {
        return [
            'women_housing_listing_id' => WomenHousingListing::factory(),
            'user_id' => User::factory(),
            'mortgage_rate_snapshot_id' => MortgageRateSnapshot::factory(),
            'principal_amount_cents' => $this->faker->numberBetween(20000000, 70000000),
            'deposit_amount_cents' => $this->faker->boolean(70) ? $this->faker->numberBetween(2000000, 15000000) : null,
            'loan_term_months' => $this->faker->numberBetween(180, 360),
            'repayment_frequency' => $this->faker->randomElement(['monthly', 'fortnightly', 'weekly']),
            'calculated_repayment_cents' => $this->faker->numberBetween(150000, 450000),
            'risk_rating' => $this->faker->randomElement(['low', 'medium', 'high']),
            'ai_commentary' => $this->faker->sentence(12),
            'generated_at' => $this->faker->dateTimeBetween('-2 days', 'now'),
        ];
    }
}

