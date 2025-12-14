<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use App\Models\AIInferenceLog;
use App\Models\WomenRealEstate\WomenAgentLead;
use App\Models\WomenRealEstate\WomenAgentVerificationAudit;
use App\Models\WomenRealEstate\WomenCohortEnrolment;
use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Models\WomenRealEstate\WomenDashboardPreference;
use App\Models\WomenRealEstate\WomenDashboardWidget;
use App\Models\WomenRealEstate\WomenGoalTracker;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenListingCategory;
use App\Models\WomenRealEstate\WomenListingLocation;
use App\Models\WomenRealEstate\WomenListingPartnerIntention;
use App\Models\WomenRealEstate\WomenListingSocialShare;
use App\Models\WomenRealEstate\WomenPartnerMatch;
use App\Models\WomenRealEstate\WomenPartnerProject;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

final class WomenRealEstateSeeder extends Seeder
{
    public function run(): void
    {
        // Demo seeding for WomenRealEstate is optional — skip by default to keep
        // db:seed safe in development environments.
        return;
    }


    /**
     * @psalm-return Collection<int<0, 3>, mixed>
     */
    private function seedCategories(): Collection
    {
        $categoryDefinitions = collect([
            [
                'slug' => 'women-first-rentals',
                'name' => 'Women-First Rentals',
                'description' => 'Safety-first rentals curated for women-led households.',
                'icon' => 'heroicons-outline-home-modern',
            ],
            [
                'slug' => 'co-living',
                'name' => 'Purposeful Co-Living',
                'description' => 'Community-centric living with wellbeing programming.',
                'icon' => 'heroicons-outline-users',
            ],
            [
                'slug' => 'shared-equity',
                'name' => 'Shared Equity Pathways',
                'description' => 'Partnership-driven pathways into ownership.',
                'icon' => 'heroicons-outline-chart-bar',
            ],
            [
                'slug' => 'impact-investing',
                'name' => 'Impact Investing',
                'description' => 'Women-led projects seeking aligned capital partners.',
                'icon' => 'heroicons-outline-building-office',
            ],
        ]);

        return $categoryDefinitions->map(fn (array $attributes) => WomenListingCategory::firstOrCreate(
            ['slug' => $attributes['slug']],
            $attributes
        ));
    }

    /**
     * @psalm-return Collection<0, mixed>
     */
    private function seedLocations(): Collection
    {
        $regionDefinitions = collect([
            [
                'name' => 'Melbourne',
                'slug' => 'melbourne-vic',
                'type' => 'city',
                'latitude' => -37.8136,
                'longitude' => 144.9631,
                'children' => [
                    ['name' => 'Brunswick', 'slug' => 'brunswick-vic', 'type' => 'suburb', 'latitude' => -37.7693, 'longitude' => 144.9635],
                    ['name' => 'Fitzroy', 'slug' => 'fitzroy-vic', 'type' => 'suburb', 'latitude' => -37.8009, 'longitude' => 144.978],
                ],
            ],
            [
                'name' => 'Sydney',
                'slug' => 'sydney-nsw',
                'type' => 'city',
                'latitude' => -33.8688,
                'longitude' => 151.2093,
                'children' => [
                    ['name' => 'Coogee', 'slug' => 'coogee-nsw', 'type' => 'suburb', 'latitude' => -33.9205, 'longitude' => 151.2554],
                    ['name' => 'Parramatta', 'slug' => 'parramatta-nsw', 'type' => 'suburb', 'latitude' => -33.814, 'longitude' => 151.0012],
                ],
            ],
            [
                'name' => 'Brisbane',
                'slug' => 'brisbane-qld',
                'type' => 'city',
                'latitude' => -27.4698,
                'longitude' => 153.0251,
                'children' => [
                    ['name' => 'West End', 'slug' => 'west-end-qld', 'type' => 'suburb', 'latitude' => -27.4819, 'longitude' => 153.006],
                    ['name' => 'Logan', 'slug' => 'logan-qld', 'type' => 'suburb', 'latitude' => -27.6395, 'longitude' => 153.1098],
                ],
            ],
            [
                'name' => 'Perth',
                'slug' => 'perth-wa',
                'type' => 'city',
                'latitude' => -31.9523,
                'longitude' => 115.8613,
                'children' => [
                    ['name' => 'Fremantle', 'slug' => 'fremantle-wa', 'type' => 'suburb', 'latitude' => -32.0569, 'longitude' => 115.7439],
                    ['name' => 'Subiaco', 'slug' => 'subiaco-wa', 'type' => 'suburb', 'latitude' => -31.9483, 'longitude' => 115.8235],
                ],
            ],
        ]);

        return $regionDefinitions->flatMap(function (array $region) {
            $city = WomenListingLocation::firstOrCreate(
                ['slug' => $region['slug']],
                [
                    'parent_id' => null,
                    'name' => $region['name'],
                    'type' => $region['type'],
                    'latitude' => $region['latitude'],
                    'longitude' => $region['longitude'],
                ]
            );

            $suburbs = collect($region['children'] ?? [])->map(fn (array $suburb) => WomenListingLocation::firstOrCreate(
                ['slug' => $suburb['slug']],
                [
                    'parent_id' => $city->id,
                    'name' => $suburb['name'],
                    'type' => $suburb['type'],
                    'latitude' => $suburb['latitude'],
                    'longitude' => $suburb['longitude'],
                ]
            ));

            return collect([$city])->merge($suburbs);
        });
    }

    /**
     * @psalm-return Collection<int<0, 2>, WomenVerifiedAgent|\Illuminate\Database\Eloquent\Collection<int, WomenVerifiedAgent>|mixed>
     */
    private function seedVerifiedAgents(): Collection
    {
        $agentDefinitions = collect([
            [
                'user' => [
                    'name' => 'Amelia Hart',
                    'email' => 'amelia.agent@example.test',
                    'role' => 'company',
                    'account_classification' => 'real_estate',
                    'preferred_name' => 'Amelia',
                    'pronouns' => 'she/her',
                ],
                'regulator' => 'VIC Consumer Affairs',
                'status' => 'verified',
            ],
            [
                'user' => [
                    'name' => 'Saira Malik',
                    'email' => 'saira.agent@example.test',
                    'role' => 'company',
                    'account_classification' => 'real_estate',
                    'preferred_name' => 'Saira',
                    'pronouns' => 'she/her',
                ],
                'regulator' => 'QLD Housing Authority',
                'status' => 'verified',
            ],
            [
                'user' => [
                    'name' => 'Linh Tran',
                    'email' => 'linh.agent@example.test',
                    'role' => 'company',
                    'account_classification' => 'real_estate',
                    'preferred_name' => 'Linh',
                    'pronouns' => 'she/her',
                ],
                'regulator' => 'WA Consumer Protection',
                'status' => 'pending',
            ],
        ]);

        return $agentDefinitions->map(function (array $definition) {
            $userAttributes = $definition['user'];

            if (empty($userAttributes['password'])) {
                $userAttributes['password'] = Hash::make('WomenRise@2025');
            }

            // Use firstOrCreate to avoid duplicate user creation
            $user = User::firstOrCreate(
                ['email' => $definition['user']['email']],
                $userAttributes
            );

            if (empty($user->password)) {
                $user->forceFill(['password' => $userAttributes['password']])->save();
            }

            // Check if agent already exists for this user
            $agent = WomenVerifiedAgent::where('user_id', $user->id)->first();

            if ($agent) {
                return $agent;
            }

            // Create new agent
            $agent = WomenVerifiedAgent::factory()
                ->state(fn () => [
                    'user_id' => $user->id,
                    'regulator' => $definition['regulator'],
                ]);

            $agent = match ($definition['status']) {
                'verified' => $agent->verified(),
                default => $agent->pending(),
            };

            return $agent->create();
        });
    }

    /**
     * @psalm-return Collection<never, never>
     */
    private function seedListings(Collection $agents, Collection $categories, Collection $locations): Collection
    {
        $suburbs = $locations->filter(fn (WomenListingLocation $location) => $location->parent_id !== null);

        return $agents->flatMap(function (WomenVerifiedAgent $agent) use ($categories, $suburbs) {
            $collection = collect();

            if ($agent->status === 'verified') {
                $collection->push(
                    WomenListing::factory()
                        ->published()
                        ->withMedia(4)
                        ->withMortgageSnapshots(2)
                        ->for($agent, 'agent')
                        ->for($categories->random(), 'category')
                        ->for($suburbs->random(), 'location')
                        ->create([
                            'is_verified' => true,
                        ])
                );
            }

            $collection->push(
                WomenListing::factory()
                    ->draft()
                    ->withMedia(2)
                    ->for($agent, 'agent')
                    ->for($categories->random(), 'category')
                    ->for($suburbs->random(), 'location')
                    ->create([
                        'is_verified' => $agent->status === 'verified',
                    ])
            );

            return $collection;
        });
    }

    private function seedSocialSignals(Collection $listings): void
    {
        $listings->each(function (WomenListing $listing): void {
            WomenListingSocialShare::factory()
                ->count(fake()->numberBetween(1, 3))
                ->create([
                    'listing_id' => $listing->id,
                ]);

            WomenListingPartnerIntention::factory()
                ->count(fake()->numberBetween(1, 2))
                ->create([
                    'listing_id' => $listing->id,
                ]);
        });
    }

    private function seedAgentLeads(Collection $agents, Collection $listings): void
    {
        $listingsByAgent = $listings->groupBy('agent_id');

        $agents->each(function (WomenVerifiedAgent $agent) use ($listingsByAgent): void {
            $agentListings = $listingsByAgent->get($agent->id, collect());

            WomenAgentLead::factory()
                ->count(fake()->numberBetween(2, 5))
                ->state(new Sequence(
                    fn () => [
                        'agent_id' => $agent->id,
                        'listing_id' => $agentListings->isNotEmpty() ? $agentListings->random()->id : null,
                    ]
                ))
                ->create();
        });
    }

    /**
     * @return WomenCohortProfile|\Illuminate\Database\Eloquent\Collection
     *
     * @psalm-return WomenCohortProfile|\Illuminate\Database\Eloquent\Collection<int, WomenCohortProfile>
     */
    private function seedCohortProfiles(): \Illuminate\Database\Eloquent\Collection|WomenCohortProfile
    {
        return WomenCohortProfile::factory()
            ->count(6)
            ->state(new Sequence(
                ['persona' => 'learner'],
                ['persona' => 'first_home_buyer'],
                ['persona' => 'investor'],
                ['persona' => 'developer'],
                ['persona' => 'mentor'],
            ))
            ->create();
    }

    private function seedCohortEnrolments(Collection $profiles): void
    {
        $cohortSlugs = collect([
            'women-finance-lab',
            'women-developers-collective',
            'women-investor-accelerator',
        ]);

        $profiles->each(function (WomenCohortProfile $profile) use ($cohortSlugs): void {
            $count = fake()->numberBetween(1, 2);
            $selectedSlugs = $cohortSlugs->shuffle()->take($count);

            $selectedSlugs->each(function (string $slug) use ($profile): void {
                WomenCohortEnrolment::factory()
                    ->state([
                        'profile_id' => $profile->id,
                        'cohort_slug' => $slug,
                    ])
                    ->create();
            });
        });
    }

    private function seedGoalTrackers(Collection $profiles): void
    {
        $goalTypes = ['savings', 'deposit', 'investment'];

        $profiles->each(function (WomenCohortProfile $profile) use ($goalTypes): void {
            foreach (fake()->randomElements($goalTypes, fake()->numberBetween(1, 3)) as $goalType) {
                WomenGoalTracker::factory()
                    ->state([
                        'profile_id' => $profile->id,
                        'goal_type' => $goalType,
                    ])
                    ->create();
            }
        });
    }

    /**
     * @psalm-return Collection<array-key, WomenPartnerProject|\Illuminate\Database\Eloquent\Collection<int, WomenPartnerProject>>
     */
    private function seedPartnerProjects(Collection $agents): Collection
    {
        return $agents
            ->filter(fn (WomenVerifiedAgent $agent) => $agent->status === 'verified')
            ->take(3)
            ->map(function (WomenVerifiedAgent $agent) {
                return WomenPartnerProject::factory()
                    ->state([
                        'owner_id' => $agent->user_id,
                    ])
                    ->seekingPartners()
                    ->create();
            });
    }

    private function seedPartnerMatches(Collection $projects, Collection $profiles): void
    {
        $profilesByPersona = $profiles->groupBy('persona');

        $projects->each(function (WomenPartnerProject $project) use ($profilesByPersona): void {
            $targetProfiles = $profilesByPersona->get('investor', collect())->merge($profilesByPersona->get('developer', collect()))->take(4);

            $targetProfiles->each(function (WomenCohortProfile $profile) use ($project): void {
                WomenPartnerMatch::factory()
                    ->state([
                        'project_id' => $project->id,
                        'profile_id' => $profile->id,
                    ])
                    ->create();
            });
        });
    }

    private function seedDashboardPreferences(Collection $profiles): void
    {
        $profiles->each(function (WomenCohortProfile $profile): void {
            $preference = WomenDashboardPreference::factory()
                ->state([
                    'user_id' => $profile->user_id,
                    'persona' => $profile->persona->value,
                ])
                ->create();

            WomenDashboardWidget::factory()
                ->count(4)
                ->state(new Sequence(
                    ['preference_id' => $preference->id, 'widget' => 'hero_summary', 'position' => 1, 'pinned' => true],
                    ['preference_id' => $preference->id, 'widget' => 'goal_tracker', 'position' => 2],
                    ['preference_id' => $preference->id, 'widget' => 'mortgage_widget', 'position' => 3],
                    ['preference_id' => $preference->id, 'widget' => 'ai_nudges', 'position' => 4],
                ))
                ->create();
        });
    }

    private function seedVerificationAudits(Collection $agents): void
    {
        $agents->each(function (WomenVerifiedAgent $agent): void {
            WomenAgentVerificationAudit::factory()
                ->count(fake()->numberBetween(1, 3))
                ->state(fn () => [
                    'agent_id' => $agent->id,
                    'reviewer_id' => User::factory()->create()->id,
                ])
                ->create();
        });
    }

    private function seedInferenceLogs(): void
    {
        AIInferenceLog::factory()->count(6)->create();
    }
}

