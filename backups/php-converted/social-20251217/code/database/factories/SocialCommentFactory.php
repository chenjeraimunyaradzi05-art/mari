<?php

namespace Database\Factories;

use App\Models\SocialComment;
use App\Models\SocialPost;
use App\Models\SocialProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\SocialComment>
 */
final class SocialCommentFactory extends Factory
{
    protected $model = SocialComment::class;

    #[\Override]
    /**
     * @return (SocialPostFactory|SocialProfileFactory|array|false|int|null|string)[]
     *
     * @psalm-return array{social_post_id: SocialPostFactory, social_profile_id: SocialProfileFactory, parent_id: null, comment: array|string, mentions: array<never, never>, likes_count: int, replies_count: 0, is_pinned: false, ai_sentiment: array{score: float, label: mixed}}
     */
    public function definition(): array
    {
        return [
            'social_post_id' => SocialPost::factory(),
            'social_profile_id' => SocialProfile::factory(),
            'parent_id' => null,
            'comment' => $this->faker->sentences(2, true),
            'mentions' => [],
            'likes_count' => $this->faker->numberBetween(0, 150),
            'replies_count' => 0,
            'is_pinned' => false,
            'ai_sentiment' => [
                'score' => $this->faker->randomFloat(2, -1, 1),
                'label' => $this->faker->randomElement(['positive', 'neutral', 'negative']),
            ],
        ];
    }
}
