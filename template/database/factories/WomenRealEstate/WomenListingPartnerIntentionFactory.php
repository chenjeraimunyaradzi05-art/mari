<?php

declare(strict_types=1);

namespace Database\Factories\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenListingPartnerIntention;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenListingPartnerIntention>
 */
final class WomenListingPartnerIntentionFactory extends Factory
{
    protected $model = WomenListingPartnerIntention::class;

    #[\Override]
    /**
     * @return ((int|mixed)[]|WomenListingFactory|\Database\Factories\UserFactory|\Illuminate\Support\Carbon|mixed|null|string)[]
     *
     * @psalm-return array{listing_id: WomenListingFactory, initiator_id: \Database\Factories\UserFactory, invitee_id: \Database\Factories\UserFactory|null, status: mixed, intent: mixed, preferences: array{budget: int, timeline: mixed}, message: string, expires_at: \Illuminate\Support\Carbon|null}
     */
    public function definition(): array
    {
        $status = $this->faker->randomElement(['draft', 'pending', 'accepted', 'declined', 'withdrawn']);

        return [
            'listing_id' => WomenListing::factory(),
            'initiator_id' => User::factory(),
            'invitee_id' => $this->faker->boolean(70) ? User::factory() : null,
            'status' => $status,
            'intent' => $this->faker->randomElement(['co_purchase', 'co_living', 'investment']),
            'preferences' => [
                'budget' => $this->faker->numberBetween(350000, 1200000),
                'timeline' => $this->faker->randomElement(['immediate', '3_months', '6_months']),
            ],
            'message' => $this->faker->paragraph(),
            'expires_at' => $status === 'pending' ? now()->addWeeks($this->faker->numberBetween(1, 6)) : null,
        ];
    }
}

