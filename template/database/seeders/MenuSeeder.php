<?php
/**
 * MenuSeeder
 * Developer: Munyaradzi Chenjerai
 */

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

final class MenuSeeder extends Seeder
{
	/**
	 * Run the database seeds.
	 *
	 * Menu seeding is optional in the test/dev environment. Keep a lightweight
	 * run implementation so `db:seed` won't fail if we don't want to populate
	 * the menu table in a given environment.
	 */
	public function run(): void
	{
		// Intentionally minimal: the application has many menu variants and
		// some environments prefer importing a snapshot. Leave this as a
		// safe no-op so DatabaseSeeder can call it without throwing.
		return;
	}
}

