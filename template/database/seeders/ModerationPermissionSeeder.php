<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

final class ModerationPermissionSeeder extends Seeder
{
	/**
	 * Run the database seeds.
	 */
	public function run(): void
	{
		app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

		$permissions = [
			['name' => 'moderation access', 'group' => 'Moderation'],
			['name' => 'moderation review', 'group' => 'Moderation'],
			['name' => 'moderation approve', 'group' => 'Moderation'],
			['name' => 'moderation reject', 'group' => 'Moderation'],
		];

		$createdPermissions = collect();
		foreach ($permissions as $permissionData) {
			$createdPermissions->push(
				Permission::firstOrCreate(
					['name' => $permissionData['name'], 'guard_name' => 'admin'],
					['group' => $permissionData['group']]
				)
			);
		}

		$adminRoleNames = ['Super Admin', 'Admin'];
		foreach ($adminRoleNames as $roleName) {
			$role = Role::where('guard_name', 'admin')->where('name', $roleName)->first();
			if ($role) {
				$role->givePermissionTo($createdPermissions);
			}
		}
	}
}


