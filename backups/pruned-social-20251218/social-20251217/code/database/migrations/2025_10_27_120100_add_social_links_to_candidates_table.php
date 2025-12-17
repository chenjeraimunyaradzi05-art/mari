<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	/**
	 * Run the migrations.
	 */
	public function up(): void
	{
		if (! Schema::hasTable('candidates')) {
			return;
		}

		Schema::table('candidates', function (Blueprint $table) {
			if (! Schema::hasColumn('candidates', 'professional_profile_url')) {
				$table->string('professional_profile_url')->nullable();
			}

			if (! Schema::hasColumn('candidates', 'github_url')) {
				$table->string('github_url')->nullable();
			}

			if (! Schema::hasColumn('candidates', 'portfolio_url')) {
				$table->string('portfolio_url')->nullable();
			}

			if (! Schema::hasColumn('candidates', 'twitter_url')) {
				$table->string('twitter_url')->nullable();
			}

			if (! Schema::hasColumn('candidates', 'facebook_url')) {
				$table->string('facebook_url')->nullable();
			}

			if (! Schema::hasColumn('candidates', 'instagram_url')) {
				$table->string('instagram_url')->nullable();
			}
		});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		if (! Schema::hasTable('candidates')) {
			return;
		}

		Schema::table('candidates', function (Blueprint $table) {
			$columns = [
				'instagram_url',
				'facebook_url',
				'twitter_url',
				'portfolio_url',
				'github_url',
				'professional_profile_url',
			];

			foreach ($columns as $column) {
				if (Schema::hasColumn('candidates', $column)) {
					$table->dropColumn($column);
				}
			}
		});
	}
};
