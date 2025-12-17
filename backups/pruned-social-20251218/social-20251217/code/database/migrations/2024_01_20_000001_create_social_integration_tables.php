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
		if (! Schema::hasTable('job_shares')) {
			Schema::create('job_shares', function (Blueprint $table) {
				$table->id();
				$table->foreignId('job_id')->constrained()->onDelete('cascade');
				$table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
				$table->string('platform');
				$table->ipAddress('ip_address')->nullable();
				$table->string('user_agent')->nullable();
				$table->timestamp('shared_at');
				$table->timestamps();

				$table->index(['job_id', 'platform']);
				$table->index('shared_at');
			});
		}

		if (! Schema::hasColumns('candidates', ['provider', 'provider_id', 'provider_token'])) {
			Schema::table('candidates', function (Blueprint $table) {
				$table->string('provider')->nullable()->after('visibility');
				$table->string('provider_id')->nullable()->after('provider');
				$table->text('provider_token')->nullable()->after('provider_id');

				$table->index(['provider', 'provider_id']);
			});
		}

		if (! Schema::hasColumns('companies', ['provider', 'provider_id', 'provider_token'])) {
			Schema::table('companies', function (Blueprint $table) {
				$table->string('provider')->nullable()->after('visibility');
				$table->string('provider_id')->nullable()->after('provider');
				$table->text('provider_token')->nullable()->after('provider_id');

				$table->index(['provider', 'provider_id']);
			});
		}
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists('job_shares');

		if (Schema::hasColumns('candidates', ['provider', 'provider_id', 'provider_token'])) {
			Schema::table('candidates', function (Blueprint $table) {
				$table->dropColumn(['provider', 'provider_id', 'provider_token']);
			});
		}

		if (Schema::hasColumns('companies', ['provider', 'provider_id', 'provider_token'])) {
			Schema::table('companies', function (Blueprint $table) {
				$table->dropColumn(['provider', 'provider_id', 'provider_token']);
			});
		}
	}
};

