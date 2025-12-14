<?php

declare(strict_types=1);

namespace Database\Factories\WomenRealEstate;

use App\Enums\WomenRealEstate\MortgageRateSource;
use App\Models\WomenRealEstate\WomenMortgageMarketRate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenMortgageMarketRate>
 */
final class WomenMortgageMarketRateFactory extends Factory
{
    protected $model = WomenMortgageMarketRate::class;

    #[\Override]
    /**
     * @return ((int|string)[]|\Illuminate\Support\Carbon|float|int|mixed|string)[]
     *
     * @psalm-return array{source: mixed, provider: string, product_name: string, comparison_rate: float, variable_rate: float, fixed_rate: float, fixed_term_years: int, loan_type: mixed, repayment_type: mixed, meta: array{max_ltv: int, eligibility: string}, effective_at: \Illuminate\Support\Carbon}
     */
    public function definition(): array
    {
        $source = $this->faker->randomElement(MortgageRateSource::cases());
        $loanType = $this->faker->randomElement(['owner_occupied', 'investor', 'co_purchase']);
        $repaymentType = $this->faker->randomElement(['principal_interest', 'interest_only']);

        return [
            'source' => $source->value,
            'provider' => $this->faker->company() . ' Bank',
            'product_name' => $this->faker->words(nb: 3, asText: true) . ' Loan',
            'comparison_rate' => $this->faker->randomFloat(3, 2.5, 7.5),
            'variable_rate' => $this->faker->optional()->randomFloat(3, 1.9, 6.2),
            'fixed_rate' => $this->faker->optional()->randomFloat(3, 2.1, 6.7),
            'fixed_term_years' => $this->faker->optional()->numberBetween(1, 5),
            'loan_type' => $loanType,
            'repayment_type' => $repaymentType,
            'meta' => [
                'max_ltv' => $this->faker->numberBetween(70, 95),
                'eligibility' => $this->faker->sentence(),
            ],
            'effective_at' => now()->subDays($this->faker->numberBetween(0, 10)),
        ];
    }
}

