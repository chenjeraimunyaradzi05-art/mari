<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up(): void
	{
		if (! Schema::hasTable('profiles') || Schema::hasColumn('profiles', 'privacy_tier')) {
			return;
		}

		Schema::table('profiles', function (Blueprint $table): void {
			$table->string('privacy_tier', 32)->default(config('privacy.defaults.tier', 'network'))
				->after('women_safety_mode');
			$table->index('privacy_tier');
		});

		DB::table('profiles')->update([
			'privacy_tier' => DB::raw("CASE
				WHEN privacy_level = 'public' THEN 'public'
				WHEN privacy_level = 'followers' THEN 'network'
				ELSE 'invite_only'
			END"),
		]);
	}

	public function down(): void
	{
		if (! Schema::hasTable('profiles') || ! Schema::hasColumn('profiles', 'privacy_tier')) {
			return;
		}

		Schema::table('profiles', function (Blueprint $table): void {
			$table->dropIndex('profiles_privacy_tier_index');
			$table->dropColumn('privacy_tier');
		});
	}
};
