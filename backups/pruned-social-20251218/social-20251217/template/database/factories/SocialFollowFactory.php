<?php

namespace Database\Factories;

use App\Models\SocialFollow;
use App\Models\SocialProfile;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * @extends Factory<\App\Models\SocialFollow>
 */
final class SocialFollowFactory extends Factory
{
	protected $model = SocialFollow::class;

	#[\Override]
	/**
	 * @return (Carbon|SocialProfileFactory|bool)[]
	 *
	 * @psalm-return array{follower_id: SocialProfileFactory, following_id: SocialProfileFactory, is_close_friend: false, notifications_enabled: true, followed_at: Carbon}
	 */
	public function definition(): array
	{
		return [
			'follower_id' => SocialProfile::factory(),
			'following_id' => SocialProfile::factory(),
			'is_close_friend' => false,
			'notifications_enabled' => true,
			'followed_at' => Carbon::now()->subMinutes($this->faker->numberBetween(0, 3_000)),
		];
	}
}
