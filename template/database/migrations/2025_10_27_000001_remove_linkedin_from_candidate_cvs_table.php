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
		if (! Schema::hasTable('candidate_cvs')) {
			return;
		}

		if (Schema::hasColumn('candidate_cvs', 'linkedin')) {
			Schema::table('candidate_cvs', function (Blueprint $table) {
				$table->dropColumn('linkedin');
			});
		}
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		if (! Schema::hasTable('candidate_cvs')) {
			return;
		}

		if (! Schema::hasColumn('candidate_cvs', 'linkedin')) {
			Schema::table('candidate_cvs', function (Blueprint $table) {
				$table->string('linkedin')->nullable()->after('website');
			});
		}
	}
};

