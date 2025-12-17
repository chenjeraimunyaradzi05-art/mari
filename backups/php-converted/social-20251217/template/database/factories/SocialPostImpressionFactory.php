<?php

namespace Database\Factories;

use App\Models\SocialPost;
use App\Models\SocialPostImpression;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * @extends Factory<\App\Models\SocialPostImpression>
 */
final class SocialPostImpressionFactory extends Factory
{
    protected $model = SocialPostImpression::class;

    #[\Override]
    /**
     * @return (Carbon|SocialPostFactory|UserFactory|array|mixed)[]
     *
     * @psalm-return array{social_post_id: SocialPostFactory, user_id: UserFactory, source: mixed, meta: array<never, never>, viewed_at: Carbon}
     */
    public function definition(): array
    {
        return [
            'social_post_id' => SocialPost::factory(),
            'user_id' => User::factory(),
            'source' => $this->faker->randomElement(['feed', 'discovery', 'notification']),
            'meta' => [],
            'viewed_at' => Carbon::now()->subMinutes($this->faker->numberBetween(0, 720)),
        ];
    }
}

