<?php

declare(strict_types=1);

namespace Database\Factories\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenListingSocialShare;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenListingSocialShare>
 */
final class WomenListingSocialShareFactory extends Factory
{
    protected $model = WomenListingSocialShare::class;

    #[\Override]
    /**
     * @return ((int|string)[]|WomenListingFactory|\Database\Factories\UserFactory|\DateTime|mixed|string)[]
     *
     * @psalm-return array{listing_id: WomenListingFactory, user_id: \Database\Factories\UserFactory, platform: mixed, share_url: string, shared_at: \DateTime, meta: array{clicks: int, utm: string}}
     */
    public function definition(): array
    {
        return [
            'listing_id' => WomenListing::factory(),
            'user_id' => User::factory(),
            'platform' => $this->faker->randomElement(['linkedin', 'instagram', 'facebook', 'twitter', 'email']),
            'share_url' => $this->faker->url(),
            'shared_at' => $this->faker->dateTimeBetween('-20 days', 'now'),
            'meta' => [
                'clicks' => $this->faker->numberBetween(0, 250),
                'utm' => $this->faker->slug(),
            ],
        ];
    }
}

