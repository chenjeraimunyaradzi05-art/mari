<?php

namespace Database\Seeders;

use App\Models\SocialComment;
use App\Models\SocialFollow;
use App\Models\SocialLike;
use App\Models\SocialMedia;
use App\Models\SocialPost;
use App\Models\SocialProfile;
use Faker\Factory as FakerFactory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

final class SocialSampleSeeder extends Seeder
{
    /**
     * Run the database seeds (lightweight / safe no-op for dev environments).
     */
    public function run(): void
    {
        // keep sample social seeding optional — leave empty for environments that
        // prefer not to populate demo social content
        return;
    }


    protected function seedFollows(Collection $profiles, \Faker\Generator $faker): void
    {
        $profiles->each(function (SocialProfile $profile) use ($profiles, $faker): void {
            $others = $profiles->where('id', '!=', $profile->id);

            if ($others->isEmpty()) {
                return;
            }

            $max = min(7, $others->count());
            $min = min(2, $max);

            if ($min === 0 || $max === 0) {
                return;
            }

            $followCount = $faker->numberBetween($min, $max);
            $randomTargets = $others->random($followCount);
            $targets = $randomTargets instanceof Collection
                ? $randomTargets
                : collect([$randomTargets]);

            $targets->each(function (SocialProfile $target) use ($profile, $faker): void {
                $exists = SocialFollow::query()
                    ->where('follower_id', $profile->id)
                    ->where('following_id', $target->id)
                    ->exists();

                if ($exists) {
                    return;
                }

                SocialFollow::create([
                    'follower_id' => $profile->id,
                    'following_id' => $target->id,
                    'is_close_friend' => $faker->boolean(10),
                    'notifications_enabled' => $faker->boolean(70),
                    'followed_at' => Carbon::now()->subDays($faker->numberBetween(1, 120)),
                ]);

                $profile->increment('following_count');
                $target->increment('followers_count');
            });
        });
    }
}

