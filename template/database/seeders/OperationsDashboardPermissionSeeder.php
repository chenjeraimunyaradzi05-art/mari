<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

final class OperationsDashboardPermissionSeeder extends Seeder
{
	/**
	 * Run the database seeds.
	 */
	public function run(): void
	{
		app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

		$permissions = [
			['name' => 'operations.trust-safety', 'group' => 'Operations'],
			['name' => 'operations.verification-hub', 'group' => 'Operations'],
			['name' => 'operations.ad-review', 'group' => 'Operations'],
			['name' => 'operations.revenue-ops', 'group' => 'Operations'],
		];

		$created = collect();
		foreach ($permissions as $perm) {
			$created->push(
				Permission::firstOrCreate(
					['name' => $perm['name'], 'guard_name' => 'admin'],
					['group' => $perm['group']]
				)
			);
		}

		$adminRoleNames = ['Super Admin', 'Admin'];
		foreach ($adminRoleNames as $roleName) {
			$role = Role::where('guard_name', 'admin')->where('name', $roleName)->first();
			if ($role) {
				$role->givePermissionTo($created->all());
			}
		}
	}
}

