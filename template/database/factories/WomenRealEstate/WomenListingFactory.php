<?php

declare(strict_types=1);

namespace Database\Factories\WomenRealEstate;

use App\Enums\WomenRealEstate\ListingAudience;
use App\Enums\WomenRealEstate\ListingIntent;
use App\Models\User;
use App\Models\WomenRealEstate\WomenListing;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenListing>
 */
final class WomenListingFactory extends Factory
{
	protected $model = WomenListing::class;

	#[\Override]
	public function definition(): array
	{
		$title = $this->faker->sentence(4);

		return [
			'uuid' => (string) Str::uuid(),
			'owner_id' => User::factory(),
			'agent_id' => null,
			'category_id' => null,
			'location_id' => null,
			'title' => $title,
			'slug' => Str::slug($title) . '-' . strtolower(Str::random(6)),
			'intent' => $this->faker->randomElement(ListingIntent::cases())->value,
			'primary_audience' => $this->faker->randomElement(ListingAudience::cases())->value,
			'audience_overrides' => null,
			'summary' => $this->faker->sentence(),
			'description' => $this->faker->paragraph(),
			'owner_story' => null,
			'features' => null,
			'bedrooms' => $this->faker->numberBetween(0, 5),
			'bathrooms' => $this->faker->numberBetween(0, 4),
			'car_spaces' => $this->faker->numberBetween(0, 3),
			'price' => $this->faker->optional()->randomFloat(2, 50, 2000),
			'price_frequency' => $this->faker->optional()->randomElement(['weekly', 'monthly', 'fortnightly']),
			'currency' => 'AUD',
			'is_verified' => false,
			'trust_score' => null,
			'market_score' => null,
			'published_via_social' => false,
			'is_ai_safe' => true,
			'ai_insights' => null,
			'ai_listing_summary' => null,
			'virtual_tour_media_id' => null,
			'published_at' => null,
			'expires_at' => null,
		];
	}

	public function published(): self
	{
		return $this->state(function (array $attributes) {
			return [
				'published_at' => now(),
			];
		});
	}

	public function draft(): self
	{
		return $this->state(function (array $attributes) {
			return [
				'published_at' => null,
			];
		});
	}
}
