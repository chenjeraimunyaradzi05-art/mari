<?php

namespace Database\Seeders;

use App\Models\PublicSectorAgency;
use App\Models\PublicSectorEngagement;
use App\Models\PublicSectorOpportunity;
use App\Models\User;
use Illuminate\Database\Seeder;

final class PublicSectorEngagementSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Find or create a Public Sector Admin user
        $adminUser = User::firstOrCreate(
            ['email' => 'public-sector-admin@athena.com'],
            [
                'name' => 'Public Sector Admin',
                'password' => bcrypt('password'),
                'role' => 'public_sector', // Assuming this is the role key
                'primary_role' => 'public_sector',
                'account_classification' => 'public_sector',
                'email_verified_at' => now(),
            ]
        );

        // 2. Assign this user as owner of an agency
        $agency = PublicSectorAgency::first();
        if ($agency) {
            $agency->update(['owner_id' => $adminUser->id]);
        } else {
            // Should have been seeded by PublicSectorDemoSeeder, but just in case
            return;
        }

        // 3. Create engagements for this agency's opportunities
        $opportunities = $agency->opportunities;

        if ($opportunities->isEmpty()) {
            return;
        }

        // Create some candidate users
        $candidates = User::factory()->count(5)->create([
            'role' => 'member',
            'primary_role' => 'member',
        ]);

        foreach ($candidates as $candidate) {
            $opportunity = $opportunities->random();

            PublicSectorEngagement::create([
                'user_id' => $candidate->id,
                'public_sector_opportunity_id' => $opportunity->id,
                'engagement_type' => 'application_started',
                'motivation' => 'Passionate about civic tech and gender equity.',
                'submitted_at' => now(),
            ]);
        }
    }
}

