<?php

namespace Database\Seeders;

use App\Enums\IdentityFlagStatus;
use App\Models\Admin;
use App\Models\Candidate;
use App\Models\Company;
use App\Models\IdentityFlag;
use App\Models\Job;
use App\Models\JobCategory;
use App\Models\JobRole;
use App\Models\JobType;
use App\Models\Order;
use App\Models\Plan;
use App\Models\SalaryType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use App\Models\User;
use App\Models\UserPrimaryPurpose;

final class MutiroAdminDashboardSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Create Admin User
        $adminEmail = 'mutiro_admin@athena.com';
        $adminPassword = 'password';

        $admin = Admin::where('email', $adminEmail)->first();
        if (!$admin) {
            $admin = new Admin();
            $admin->name = 'Mutiro Admin';
            $admin->email = $adminEmail;
            $admin->password = Hash::make($adminPassword);
            $admin->save();

            // Assign Super Admin role if exists, otherwise create it
            if (!Role::where('name', 'Super Admin')->where('guard_name', 'admin')->exists()) {
                Role::create(['name' => 'Super Admin', 'guard_name' => 'admin']);
            }
            $admin->assignRole('Super Admin');

            $this->command->info("Admin user created: {$adminEmail} / {$adminPassword}");
        } else {
            $this->command->info("Admin user already exists: {$adminEmail}");
        }

        // Ensure a matching web User exists for the Mutiro admin (useful for UI tests)
        if (! Role::where('name', 'admin')->exists()) {
            Role::create(['name' => 'admin']);
        }

        $user = User::firstOrCreate(
            ['email' => $adminEmail],
            ['name' => 'Mutiro Admin', 'email_verified_at' => now(), 'password' => Hash::make($adminPassword)]
        );

        if (! $user->hasRole('admin')) {
            $user->assignRole('admin');
        }

        if (! $user->primaryPurposeProfile) {
            UserPrimaryPurpose::factory()->for($user)->create([
                'primary_purpose' => 'candidate',
                'identity_alignment' => 'woman_identifying',
            ]);
        }

        // 2. Create Plans (needed for Orders)
        if (Plan::count() == 0) {
            Plan::create([
                'label' => 'Standard Plan',
                'price' => 99.00,
                'job_limit' => 5,
                'featured_job_limit' => 2,
                'highlight_job_limit' => 2,
                'profile_verified' => true,
                'recommended' => true,
                'frontend_show' => true,
                'allow_social_posts' => true,
                'social_post_limit' => 10,
            ]);
        }
        $plan = Plan::first();

        // 3. Create Companies
        $companies = Company::factory()->count(20)->create();
        $this->command->info('20 Companies created.');

        // 4. Create Orders (Earnings)
        foreach ($companies as $company) {
            Order::create([
                'company_id' => $company->id,
                'plan_id' => $plan->id,
                'package_name' => $plan->label,
                'transaction_id' => 'TXN-' . uniqid(),
                'order_id' => 'ORD-' . uniqid(),
                'payment_provider' => 'stripe',
                'amount' => $plan->price,
                'paid_in_currency' => 'USD',
                'default_amount' => $plan->price,
                'payment_status' => 'paid',
                'created_at' => now()->subDays(rand(1, 30)),
            ]);
        }
        $this->command->info('Orders created for companies.');

        // 5. Create Candidates (Users)
        User::factory()->count(50)->create();
        // Ensure Candidate models exist for these users (Candidate model usually linked to User)
        // Assuming CandidateFactory creates a User or links to one.
        // Let's check CandidateFactory. If it creates a user, we are good.
        // If not, we might need to create Candidates explicitly.
        // For now, let's assume User factory handles basic user creation.
        // But Dashboard counts `Candidate::count()`.
        // Let's create Candidates explicitly using factory if possible.
        Candidate::factory()->count(50)->create();
        $this->command->info('50 Candidates created.');

        // 6. Create Jobs
        // Ensure dependencies exist
        if (JobCategory::count() == 0) JobCategory::factory()->count(5)->create();
        if (JobRole::count() == 0) JobRole::factory()->count(5)->create();
        if (JobType::count() == 0) JobType::factory()->count(3)->create();
        if (SalaryType::count() == 0) SalaryType::factory()->count(3)->create();

        $jobCategories = JobCategory::all();
        $jobRoles = JobRole::all();
        $jobTypes = JobType::all();
        $salaryTypes = SalaryType::all();

        // Active Jobs
        Job::factory()->count(30)->create([
            'company_id' => $companies->random()->id,
            'job_category_id' => $jobCategories->random()->id,
            'job_role_id' => $jobRoles->random()->id,
            'job_type_id' => $jobTypes->random()->id,
            'salary_type_id' => $salaryTypes->random()->id,
            'deadline' => now()->addDays(rand(10, 30)),
            'status' => 'active',
        ]);

        // Expired Jobs
        Job::factory()->count(20)->create([
            'company_id' => $companies->random()->id,
            'job_category_id' => $jobCategories->random()->id,
            'job_role_id' => $jobRoles->random()->id,
            'job_type_id' => $jobTypes->random()->id,
            'salary_type_id' => $salaryTypes->random()->id,
            'deadline' => now()->subDays(rand(1, 30)),
            'status' => 'active', // Status active but deadline passed = expired in logic
        ]);

        // Pending Jobs
        Job::factory()->count(15)->create([
            'company_id' => $companies->random()->id,
            'job_category_id' => $jobCategories->random()->id,
            'job_role_id' => $jobRoles->random()->id,
            'job_type_id' => $jobTypes->random()->id,
            'salary_type_id' => $salaryTypes->random()->id,
            'deadline' => now()->addDays(rand(10, 30)),
            'status' => 'pending',
        ]);
        $this->command->info('Jobs (Active, Expired, Pending) created.');

        // 7. Identity Flags (for Avg Resolution Time)
        $users = User::all();
        if ($users->count() > 0) {
            foreach(range(1, 20) as $i) {
                $flaggedAt = now()->subHours(rand(1, 48));
                $resolvedAt = clone $flaggedAt;
                $resolvedAt->addMinutes(rand(30, 300)); // 30 mins to 5 hours resolution

                IdentityFlag::create([
                    'user_id' => $users->random()->id,
                    'source' => 'system',
                    'type' => 'suspicious_activity',
                    'status' => IdentityFlagStatus::Resolved,
                    'severity' => 'medium',
                    'score' => 0.8,
                    'reason' => 'Automated test flag',
                    'flagged_at' => $flaggedAt,
                    'resolved_at' => $resolvedAt,
                    'resolved_by_admin_id' => $admin->id,
                    'resolution_notes' => 'Resolved by seeder',
                ]);
            }
            $this->command->info('Identity Flags created.');
        }
    }
}

