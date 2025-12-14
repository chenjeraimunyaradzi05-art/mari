<?php

namespace Database\Seeders;

use App\Enums\CompanyVerificationStatus;
use App\Models\Candidate;
use App\Models\Company;
use App\Models\IndustryType;
use App\Models\JobCategory;
use App\Models\OrganizationType;
use App\Models\Plan;
use App\Models\Post;
use App\Models\Skill;
use App\Models\TeamSize;
use App\Models\User;
use Faker\Factory as FakerFactory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Spatie\Permission\Exceptions\RoleDoesNotExist;

final class DummyDataSeeder extends Seeder
{
    /**
     * Seed lightweight demo data that is safe to run in developer environments.
     */
    public function run(): void
    {
        // keep the dummy seeding minimal for CI / dev: ensure core plans exist
        $this->ensurePlans();
        return;
    }


    private function ensurePlans(): void
    {
        $plans = [
            [
                'label' => 'Starter',
                'price' => 0,
                'job_limit' => 5,
                'featured_job_limit' => 0,
                'highlight_job_limit' => 0,
                'profile_verified' => false,
                'recommended' => false,
                'frontend_show' => true,
                'allow_social_posts' => false,
                'social_post_limit' => 0,
            ],
            [
                'label' => 'Growth',
                'price' => 99,
                'job_limit' => 25,
                'featured_job_limit' => 3,
                'highlight_job_limit' => 5,
                'profile_verified' => true,
                'recommended' => true,
                'frontend_show' => true,
                'allow_social_posts' => true,
                'social_post_limit' => 30,
            ],
            [
                'label' => 'Enterprise',
                'price' => 249,
                'job_limit' => 100,
                'featured_job_limit' => 10,
                'highlight_job_limit' => 15,
                'profile_verified' => true,
                'recommended' => false,
                'frontend_show' => true,
                'allow_social_posts' => true,
                'social_post_limit' => 120,
            ],
        ];

        $hasAllowSocialPosts = Schema::hasColumn('plans', 'allow_social_posts');
        $hasSocialPostLimit = Schema::hasColumn('plans', 'social_post_limit');

        foreach ($plans as $plan) {
            if (! $hasAllowSocialPosts) {
                unset($plan['allow_social_posts']);
            }

            if (! $hasSocialPostLimit) {
                unset($plan['social_post_limit']);
            }

            Plan::updateOrCreate(
                ['label' => $plan['label']],
                $plan
            );
        }
    }

    private function createPostsFor(User $user, Collection $skills, Collection $categories, \Faker\Generator $faker, string $authorType): void
    {
        $skillPool = $skills->isNotEmpty()
            ? $skills
            : collect(['leadership', 'collaboration', 'analytics', 'communication']);

        $tagPool = collect(['career', 'hiring', 'culture', 'growth', 'ai', 'talent', 'women-in-tech']);

        $sectorPool = $categories->isNotEmpty()
            ? $categories
            : collect(['Technology', 'Healthcare', 'Finance', 'Education']);

        $postCount = rand(2, 4);

        for ($i = 0; $i < $postCount; $i++) {
            $skillsSelection = $skillPool->shuffle()->take(rand(1, 3))->values()->all();
            $tags = $tagPool->shuffle()->take(rand(1, 3))->map(fn (string $tag) => '#' . Str::slug($tag))->implode(',');

            Post::factory()
                ->for($user)
                ->create([
                    'content' => $faker->paragraphs(3, true),
                    'visibility' => 'public',
                    'author_type' => $authorType,
                    'tags' => $tags,
                    'audience_sector' => $sectorPool->random(),
                    'audience_skills' => $skillsSelection,
                    'metadata' => [
                        'source' => 'demo-seeder',
                        'posted_via' => $faker->randomElement(['web', 'mobile']),
                    ],
                    'match_insights' => [
                        'sectors' => [$sectorPool->random()],
                        'skills' => $skillsSelection,
                    ],
                ]);
        }
    }

    private function assignRoleIfExists(User $user, string $role): void
    {
        if (! method_exists($user, 'assignRole')) {
            return;
        }

        try {
            $user->assignRole($role);
        } catch (RoleDoesNotExist $exception) {
            // Swallow the exception so seeding can proceed without roles present.
        }
    }
}

