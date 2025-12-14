<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up(): void
	{
		if (! Schema::hasTable('users')) {
			return;
		}

		Schema::table('users', function (Blueprint $table): void {
			if (! Schema::hasColumn('users', 'preferred_name')) {
				$table->string('preferred_name', 191)->nullable()->after('name');
			}

			if (! Schema::hasColumn('users', 'pronouns')) {
				$table->string('pronouns', 50)->nullable()->after('preferred_name');
			}

			if (! Schema::hasColumn('users', 'timezone')) {
				$table->string('timezone', 64)->default('UTC')->after('pronouns');
			}

			if (! Schema::hasColumn('users', 'onboarding_step')) {
				$table->string('onboarding_step', 64)->nullable()->after('timezone');
			}

			if (! Schema::hasColumn('users', 'persona_flags')) {
				$table->json('persona_flags')->nullable()->after('onboarding_step');
			}
		});

		if (Schema::hasColumn('users', 'timezone')) {
			DB::table('users')
				->whereNull('timezone')
				->update(['timezone' => 'UTC']);
		}
	}

	public function down(): void
	{
		// No rollback: these columns are required for onboarding.
	}
};
