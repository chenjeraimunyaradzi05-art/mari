<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;

use Illuminate\Database\Seeder;

final class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // \App\Models\User::factory(10)->create();

        // \App\Models\User::factory()->create([
        //     'name' => 'Test User',
        //     'email' => 'test@example.com',
        // ]);

        // Roles and permissions (must run first)
        $this->call(RolesAndPermissionsSeeder::class);
        $this->call(MenuSeeder::class);
        $this->call(VerificationPermissionSeeder::class);
        $this->call(OperationsDashboardPermissionSeeder::class);

        $this->call(JobCategorySeeder::class);
        $this->call(JobRoleSeeder::class);
        $this->call(ProfessionSeeder::class);
        $this->call(SkillSeeder::class);
        $this->call(CountrySeeder::class);
        $this->call(ExperienceSeeder::class);
        $this->call(IndustryTypeSeeder::class);
        $this->call(OrganizationTypeSeeder::class);
        $this->call(TeamSizeSeeder::class);
        $this->call(JobSalaryTypeSeeder::class);
        $this->call(JobEducationSeeder::class);
        $this->call(JobTypeSeeder::class);
        $this->call(JobTagSeeder::class);

        // Women-focused profile reference data
        $this->call(PronounSeeder::class);
        $this->call(EthnicitySeeder::class);
        $this->call(DriverLicenseTypeSeeder::class);
        $this->call(MaritalStatusSeeder::class);
        $this->call(ReligionSeeder::class);

        // Demo / dummy content to visualise the product
        $this->call(MortgageRateSnapshotSeeder::class);
        $this->call(RealEstateLearningPathSeeder::class);
        $this->call(DummyDataSeeder::class);
        $this->call(SocialSampleSeeder::class);
        $this->call(SocialOperationsDemoSeeder::class);
        $this->call(PublicSectorDemoSeeder::class);
        $this->call(GrantProgramSeeder::class);
        $this->call(FinancialWellnessSeeder::class);
        $this->call(BankFeedSeeder::class);
        $this->call(BusinessFinanceDemoSeeder::class);
        $this->call(AdvertisingSlotSeeder::class);
        $this->call(GrantFilterPresetSeeder::class);
        $this->call(WellbeingEventSeeder::class);
        $this->call(WellbeingPartnerOfferSeeder::class);
        $this->call(TafeUniversityDemoSeeder::class);

        // Role dashboards demo data so dashboards show live KPI tiles in dev/staging
        $this->call(\Database\Seeders\RoleDashboardsDemoSeeder::class);

        if (config('seeding.prd_personas', false)) {
            $this->call(PrdPersonaSeeder::class);
        }

        $this->call(WomenRealEstateSeeder::class);

        // WomenRise reference implementation snapshot
        $this->call(WomenRiseCoreSeeder::class);

        // Member Profile Data
        $this->call(MemberProfileSeeder::class);

        // Analytics & marketplace baselines for redesigned dashboards
        $this->call([
            VerticalInsightsSeeder::class,
            CareerIntelligenceSnapshotSeeder::class,
            CreatorPayoutSeeder::class,
            SocialMetricsDailySeeder::class,
            ServiceListingSeeder::class,
            AutomotiveSeeder::class,
        ]);
    }
}

