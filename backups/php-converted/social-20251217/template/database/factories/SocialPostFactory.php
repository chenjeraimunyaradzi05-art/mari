<?php

namespace Database\Factories;

use App\Models\SocialPost;
use App\Models\SocialProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;

/**
 * @extends Factory<\App\Models\SocialPost>
 */
final class SocialPostFactory extends Factory
{
	protected $model = SocialPost::class;

	#[\Override]
	/**
	 * @return ((mixed|string)[]|Carbon|SocialProfileFactory|UserFactory|false|float|int|mixed|null|string)[]
	 *
	 * @psalm-return array{social_profile_id: SocialProfileFactory, post_type: mixed, caption: string, media: array, location: string, tags: array<int<0, max>, string>, mentions: array<never, never>, likes_count: 0, comments_count: 0, shares_count: int, views_count: int, is_pinned: false, comments_disabled: false, visibility: mixed, published_at: Carbon, expires_at: Carbon|null, ai_engagement_score: float, ai_tags: array|string, user_id?: UserFactory}
	 */
	public function definition(): array
	{
		$publishedAt = Carbon::now()->subMinutes($this->faker->numberBetween(5, 1440));
		$postType = $this->faker->randomElement(['post', 'reel', 'story', 'article']);

		$data = [
			'social_profile_id' => SocialProfile::factory(),
			'post_type' => $postType,
			'caption' => $this->faker->sentence(12),
			'media' => $this->faker->boolean(65) ? $this->fakeMediaPayload($postType) : [],
			'location' => $this->faker->optional()->city(),
			'tags' => $this->faker->boolean(55)
				? collect(range(1, $this->faker->numberBetween(1, 3)))->map(fn () => '#'.$this->faker->word())->all()
				: [],
			'mentions' => [],
			'likes_count' => 0,
			'comments_count' => 0,
			'shares_count' => $this->faker->numberBetween(0, 300),
			'views_count' => $this->faker->numberBetween(0, 15000),
			'is_pinned' => false,
			'comments_disabled' => false,
			'visibility' => $this->faker->randomElement(['public', 'followers', 'private']),
			'published_at' => $publishedAt,
			'expires_at' => $postType === 'story' ? $publishedAt->copy()->addHours(24) : null,
			'ai_engagement_score' => $this->faker->randomFloat(2, 0, 1),
			'ai_tags' => $this->faker->boolean(40) ? $this->faker->words(3) : [],
		];

		if (Schema::hasColumn('social_posts', 'user_id')) {
			$data['user_id'] = User::factory();
		}

		return $data;
	}

	#[\Override]
	public function configure()
	{
		return $this
			->afterMaking(function (SocialPost $post): void {
				if (! $post->social_profile_id && $post->profile) {
					$post->social_profile_id = $post->profile->getKey();
				}

				if (Schema::hasColumn('social_posts', 'postable_type') && ! $post->postable_type) {
					$post->postable_type = SocialProfile::class;
				}

				if (
					Schema::hasColumn('social_posts', 'postable_id')
					&& ! $post->postable_id
					&& $post->social_profile_id
				) {
					$post->postable_id = $post->social_profile_id;
				}
			})
			->afterCreating(function (SocialPost $post): void {
				if (
					Schema::hasColumn('social_posts', 'postable_id')
					&& ! $post->postable_id
					&& $post->social_profile_id
				) {
					$post->postable_id = $post->social_profile_id;
					$post->saveQuietly();
				}

				$post->profile?->increment('posts_count');
			});
	}

	/**
	 * Make a post flagged as editorial/pinned.
	 */
	public function pinned(): self
	{
		return $this->state(fn () => [
			'is_pinned' => true,
			'post_type' => 'post',
		]);
	}

	/**
	 * @return ((array|string)[]|string)[][]
	 *
	 * @psalm-return array<int<0, max>, array{type: 'image'|'video', url: string, thumbnail: string, ai: array{objects: array|string}}>
	 */
	protected function fakeMediaPayload(string $postType): array
	{
		$mediaType = $postType === 'reel' ? 'video' : 'image';

		return collect(range(1, $this->faker->numberBetween(1, 3)))->map(function () use ($mediaType) {
			return [
				'type' => $mediaType,
				'url' => $this->faker->imageUrl(800, 800, 'abstract'),
				'thumbnail' => $this->faker->imageUrl(200, 200, 'abstract'),
				'ai' => [
					'objects' => $this->faker->words(2),
				],
			];
		})->all();
	}
}

