<?php

namespace Database\Factories;

use App\Models\SocialMedia;
use App\Models\SocialPost;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\SocialPostMedia>
 */
final class SocialPostMediaFactory extends Factory
{
	protected $model = SocialMedia::class;

	#[\Override]
	/**
	 * @return (SocialPostFactory|int|mixed|string|string[])[]
	 *
	 * @psalm-return array{social_post_id: SocialPostFactory, media_type: mixed, path: string, thumbnail_path: string, mime_type: mixed, file_size: int, width: int, height: int, duration: int, sort_order: int, position: int, meta: array{alt: string}, ai_analysis: array<never, never>, filters: array<never, never>}
	 */
	public function definition(): array
	{
		return [
			'social_post_id' => SocialPost::factory(),
			'media_type' => $this->faker->randomElement(['image', 'video']),
			'path' => $this->faker->imageUrl(),
			'thumbnail_path' => $this->faker->optional()->imageUrl(),
			'mime_type' => $this->faker->randomElement(['image/jpeg', 'image/png', 'video/mp4']),
			'file_size' => $this->faker->numberBetween(40_000, 2_500_000),
			'width' => $this->faker->numberBetween(400, 1920),
			'height' => $this->faker->numberBetween(300, 1080),
			'duration' => $this->faker->optional()->numberBetween(1, 240),
			'sort_order' => $this->faker->numberBetween(0, 3),
			'position' => $this->faker->numberBetween(0, 3),
			'meta' => ['alt' => $this->faker->sentence()],
			'ai_analysis' => [],
			'filters' => [],
		];
	}
}

