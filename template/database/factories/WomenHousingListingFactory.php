<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\User;
use App\Models\WomenHousingListing;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

final class WomenHousingListingFactory extends Factory
{
    protected $model = WomenHousingListing::class;

    #[\Override]
    /**
     * @return ((float|mixed|string)[]|UserFactory|\DateTime|mixed|null|scalar)[]
     *
     * @psalm-return array{uuid: string, owner_user_id: UserFactory, agent_profile_id: null, title: string, slug: string, listing_type: mixed, audience: mixed, description: string, price_cents: int, currency: 'AUD', bond_cents: int, mortgage_required: bool, location: array{address_line1: string, suburb: string, state: mixed, postcode: string, country: 'AU', lat: float, lng: float}, amenities: array{safety: 'Secure entry', transport: 'Near station'}, availability_date: \DateTime, verification_status: mixed, moderation_status: mixed, visibility: mixed, ai_tags: null, ai_recommendation_score: float}
     */
    public function definition(): array
    {
        $title = $this->faker->sentence(4);

        return [
            'uuid' => (string) Str::uuid(),
            'owner_user_id' => User::factory(),
            'agent_profile_id' => null,
            'title' => $title,
            'slug' => Str::slug($title) . '-' . Str::lower(Str::random(6)),
            'listing_type' => $this->faker->randomElement(['rent_shared', 'rent_private', 'buy', 'investment']),
            'audience' => $this->faker->randomElement(['women_only', 'women_students', 'women_professionals', 'women_caregivers', 'women_retirees']),
            'description' => $this->faker->paragraph(),
            'price_cents' => $this->faker->numberBetween(1000, 800000),
            'currency' => 'AUD',
            'bond_cents' => $this->faker->numberBetween(0, 400000),
            'mortgage_required' => $this->faker->boolean(),
            'location' => [
                'address_line1' => $this->faker->streetAddress(),
                'suburb' => $this->faker->city(),
                'state' => $this->faker->stateAbbr(),
                'postcode' => $this->faker->postcode(),
                'country' => 'AU',
                'lat' => $this->faker->latitude(),
                'lng' => $this->faker->longitude(),
            ],
            'amenities' => [
                'safety' => 'Secure entry',
                'transport' => 'Near station',
            ],
            'availability_date' => $this->faker->dateTimeBetween('+1 week', '+1 year'),
            'verification_status' => $this->faker->randomElement(['pending', 'verified', 'rejected']),
            'moderation_status' => $this->faker->randomElement(['clean', 'flagged', 'under_review']),
            'visibility' => $this->faker->randomElement(['public', 'community', 'private']),
            'ai_tags' => null,
            'ai_recommendation_score' => $this->faker->randomFloat(2, 0, 1),
        ];
    }
}

