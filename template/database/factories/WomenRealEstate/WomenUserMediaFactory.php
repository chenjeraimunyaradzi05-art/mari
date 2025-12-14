<?php

namespace Database\Factories\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenUserMedia;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenUserMedia>
 */
final class WomenUserMediaFactory extends Factory
{
	protected $model = WomenUserMedia::class;

	#[\Override]
	public function definition(): array
	{
		$uuid = $this->faker->uuid();

		return [
			'user_id' => User::factory(),
			'disk' => 'public',
			'path' => "women_media/{$uuid}.jpg",
			'media_type' => 'image/jpeg',
			'caption' => $this->faker->optional()->sentence(),
			'visibility' => $this->faker->randomElement(['public', 'private', 'followers']),
			'meta' => null,
			'published_at' => $this->faker->optional()->dateTimeBetween('-1 year', '+1 year'),
		];
	}
}

