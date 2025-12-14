<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

final class RolesAndPermissionsSeeder extends Seeder
{
	/**
	 * Run the database seeds.
	 */
	public function run(): void
	{
		// Clear any cached permissions to ensure firstOrCreate works reliably
		app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

		// Minimal web-guard permissions the app expects in many integration tests and views
		$permissions = [
			['name' => 'profile.manage', 'group' => 'Profile', 'guard' => 'web'],
			['name' => 'listing.create', 'group' => 'Listings', 'guard' => 'web'],
			['name' => 'listing.update', 'group' => 'Listings', 'guard' => 'web'],
			['name' => 'listing.delete', 'group' => 'Listings', 'guard' => 'web'],
		];

		$created = collect();
		foreach ($permissions as $perm) {
			$created->push(
				Permission::firstOrCreate(
					['name' => $perm['name'], 'guard_name' => $perm['guard']],
					['group' => $perm['group']]
				)
			);
		}

		// Ensure common roles exist for both web and admin guards
		$webRoles = ['Super Admin', 'Admin', 'Moderator', 'Editor', 'User'];
		foreach ($webRoles as $rname) {
			Role::firstOrCreate(['name' => $rname, 'guard_name' => 'web']);
		}

		// Ensure admin roles are present (many admin permissions/seeders attach to these)
		$adminRoles = ['Super Admin', 'Admin'];
		foreach ($adminRoles as $rname) {
			Role::firstOrCreate(['name' => $rname, 'guard_name' => 'admin']);
		}

		// Put created web permissions onto web Super Admin (if present)
		$super = Role::where('guard_name', 'web')->where('name', 'Super Admin')->first();
		if ($super) {
			$super->givePermissionTo($created->all());
		}
	}
}

