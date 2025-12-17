<?php

namespace Database\Factories;

use App\Models\SocialComment;
use App\Models\SocialLike;
use App\Models\SocialPost;
use App\Models\SocialProfile;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * @extends Factory<\App\Models\SocialLike>
 */
final class SocialLikeFactory extends Factory
{
    protected $model = SocialLike::class;

    #[\Override]
    /**
     * @return (Carbon|SocialPostFactory|SocialProfileFactory|string)[]
     *
     * @psalm-return array{social_profile_id: SocialProfileFactory, likeable_type: SocialPost::class, likeable_id: SocialPostFactory, liked_at: Carbon}
     */
    public function definition(): array
    {
        return [
            'social_profile_id' => SocialProfile::factory(),
            'likeable_type' => SocialPost::class,
            'likeable_id' => SocialPost::factory(),
            'liked_at' => Carbon::now()->subMinutes($this->faker->numberBetween(0, 10_080)),
        ];
    }

    // removed unused factory helper: forPost
}
