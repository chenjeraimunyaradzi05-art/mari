<?php

namespace Database\Factories;

use App\Models\SocialPost;
use App\Models\SocialPostReaction;
use App\Models\SocialProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * @extends Factory<\App\Models\SocialPostReaction>
 */
final class SocialPostReactionFactory extends Factory
{
	protected $model = SocialPostReaction::class;

	#[\Override]
	/**
	 * @return (Carbon|SocialPostFactory|SocialProfileFactory|\Closure|mixed|string)[]
	 *
	 * @psalm-return array{social_profile_id: SocialProfileFactory, user_id: \Closure(array):(UserFactory|int), social_post_id: SocialPostFactory, reaction: mixed, liked_at: Carbon, likeable_type: SocialPost::class, likeable_id: \Closure(array):mixed}
	 */
	public function definition(): array
	{
		return [
			'social_profile_id' => SocialProfile::factory(),
			'user_id' => function (array $attributes) {
				$profileId = $attributes['social_profile_id'] ?? null;

				if ($profileId) {
					$profile = SocialProfile::with('profileable')->find($profileId);
					$owner = $profile?->resolveOwnerUser();

					if ($owner) {
						return $owner->id;
					}
				}

				return User::factory();
			},
			'social_post_id' => SocialPost::factory(),
			'reaction' => $this->faker->randomElement(['like', 'celebrate', 'insightful']),
			'liked_at' => Carbon::now()->subMinutes($this->faker->numberBetween(0, 1440)),
			'likeable_type' => SocialPost::class,
			'likeable_id' => fn (array $attributes) => $attributes['social_post_id'],
		];
	}
}

