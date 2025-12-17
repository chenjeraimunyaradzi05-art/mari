<?php

namespace Database\Factories;

use App\Models\SocialComment;
use App\Models\SocialPost;
use App\Models\SocialPostComment;
use App\Models\SocialProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\SocialPostComment>
 */
final class SocialPostCommentFactory extends Factory
{
	protected $model = SocialPostComment::class;

	#[\Override]
	/**
	 * @return (SocialPostFactory|UserFactory|array|false|int|null|string)[]
	 *
	 * @psalm-return array{social_post_id: SocialPostFactory, user_id: UserFactory, social_profile_id: null, parent_id: null, content: string, mentions: array<never, never>, likes_count: 0, replies_count: 0, is_pinned: false, ai_sentiment: null, meta: array<never, never>}
	 */
	public function definition(): array
	{
		return [
			'social_post_id' => SocialPost::factory(),
			'user_id' => User::factory(),
			'social_profile_id' => null,
			'parent_id' => null,
			'content' => $this->faker->sentence(),
			'mentions' => [],
			'likes_count' => 0,
			'replies_count' => 0,
			'is_pinned' => false,
			'ai_sentiment' => null,
			'meta' => [],
		];
	}

	#[\Override]
	public function configure()
	{
		return $this->afterCreating(function (SocialComment $comment): void {
			$this->ensureProfile($comment);
		});
	}

	protected function ensureProfile(SocialComment $comment): void
	{
		$existingOwnerId = $comment->profile?->resolveOwnerUser()?->id;
		if ($comment->social_profile_id && $existingOwnerId && (int) $existingOwnerId === (int) $comment->user_id) {
			return;
		}

		$user = $comment->user ?? User::find($comment->user_id);

		if (! $user) {
			$user = User::factory()->create();
			$comment->user()->associate($user);
		}

		$profile = $user->relationLoaded('socialProfile') ? $user->socialProfile : $user->socialProfile()->first();

		if (! $profile) {
			$profile = SocialProfile::factory()->create([
				'profileable_type' => User::class,
				'profileable_id' => $user->id,
				'profile_type' => $user->company ? 'company' : 'candidate',
			]);
		}

		$comment->social_profile_id = $profile->id;
		$comment->save();
	}
}

