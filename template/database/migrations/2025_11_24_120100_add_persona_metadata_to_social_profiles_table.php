<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up(): void
	{
		if (! Schema::hasTable('social_profiles')) {
			return;
		}

		Schema::table('social_profiles', function (Blueprint $table): void {
			if (! Schema::hasColumn('social_profiles', 'persona_key')) {
				$table->string('persona_key', 40)->nullable()->after('profile_type');
			}

			if (! Schema::hasColumn('social_profiles', 'persona_meta')) {
				$table->json('persona_meta')->nullable()->after('persona_key');
			}

			if (! Schema::hasColumn('social_profiles', 'privacy_preferences')) {
				$table->json('privacy_preferences')->nullable()->after('is_private');
			}
		});
	}

	public function down(): void
	{
		if (! Schema::hasTable('social_profiles')) {
			return;
		}

		Schema::table('social_profiles', function (Blueprint $table): void {
			if (Schema::hasColumn('social_profiles', 'privacy_preferences')) {
				$table->dropColumn('privacy_preferences');
			}

			if (Schema::hasColumn('social_profiles', 'persona_meta')) {
				$table->dropColumn('persona_meta');
			}

			if (Schema::hasColumn('social_profiles', 'persona_key')) {
				$table->dropColumn('persona_key');
			}
		});
	}
};
