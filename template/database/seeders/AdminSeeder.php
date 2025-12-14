<?php
/**
 * AdminSeeder
 * Developer: Munyaradzi Chenjerai
 */

namespace Database\Seeders;

use App\Models\Admin;
use App\Models\User;
use App\Models\UserPrimaryPurpose;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

final class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Ensure the Super Admin role exists for the admin guard before assigning
        Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'admin']);

        // Create or find the admin account (idempotent)
        $admin = Admin::firstOrCreate(
            ['email' => 'superadmin@gmail.com'],
            ['name' => 'Super Admin', 'password' => bcrypt('password')]
        );

        // assign role (ensure idempotent)
        if (! $admin->hasRole('Super Admin')) {
            $admin->assignRole('Super Admin');
        }

        // Ensure the Super Admin role for the admin guard has every admin permission
        $adminRole = Role::firstWhere(['name' => 'Super Admin', 'guard_name' => 'admin']);
        if ($adminRole) {
            $adminPermissions = Permission::where('guard_name', 'admin')->get();
            if ($adminPermissions->isNotEmpty()) {
                $adminRole->syncPermissions($adminPermissions->pluck('name')->all());
            }
        }

        // Also ensure the web Super Admin role has all web-scoped permissions
        $webRole = Role::firstWhere(['name' => 'Super Admin', 'guard_name' => 'web']);
        if ($webRole) {
            $webPermissions = Permission::where('guard_name', 'web')->get();
            if ($webPermissions->isNotEmpty()) {
                $webRole->syncPermissions($webPermissions->pluck('name')->all());
            }
        }

        // Also ensure a matching demo User exists for web tests (and has a primary purpose)
        // Ensure the 'admin' web role exists for the demo user (explicit web guard)
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);

        $user = User::firstOrCreate(
            ['email' => 'superadmin@gmail.com'],
            ['name' => 'Super Admin', 'email_verified_at' => now(), 'password' => bcrypt('password')]
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

    }
}

