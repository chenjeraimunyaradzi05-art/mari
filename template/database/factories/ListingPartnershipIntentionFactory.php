<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\ListingPartnershipIntention;
use App\Models\User;
use App\Models\WomenHousingListing;
use Illuminate\Database\Eloquent\Factories\Factory;

final class ListingPartnershipIntentionFactory extends Factory
{
    protected $model = ListingPartnershipIntention::class;

    #[\Override]
    /**
     * @return (UserFactory|WomenHousingListingFactory|array|int|mixed|string)[]
     *
     * @psalm-return array{women_housing_listing_id: WomenHousingListingFactory, initiator_user_id: UserFactory, intent_type: mixed, budget_range_min_cents: int, budget_range_max_cents: int, preferred_finance_type: mixed, skills_offered: array, availability_window: string, status: 'pending', notes: string}
     */
    public function definition(): array
    {
        $minBudget = $this->faker->numberBetween(20000, 120000) * 100;

        return [
            'women_housing_listing_id' => WomenHousingListing::factory(),
            'initiator_user_id' => User::factory(),
            'intent_type' => $this->faker->randomElement(['co_rent', 'co_buy', 'co_develop']),
            'budget_range_min_cents' => $minBudget,
            'budget_range_max_cents' => $minBudget + $this->faker->numberBetween(5000, 80000) * 100,
            'preferred_finance_type' => $this->faker->randomElement(['mortgage', 'cash', 'shared_equity', 'rent']),
            'skills_offered' => $this->faker->randomElements([
                'legal', 'finance', 'construction', 'community-building', 'sustainability',
            ], $this->faker->numberBetween(1, 3)),
            'availability_window' => $this->faker->sentence(3),
            'status' => 'pending',
            'notes' => $this->faker->optional()->sentence(),
        ];
    }
}

