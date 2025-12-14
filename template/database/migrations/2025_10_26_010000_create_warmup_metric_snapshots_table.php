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
		if (Schema::hasTable('warmup_metric_snapshots')) {
			return;
		}

		Schema::create('warmup_metric_snapshots', function (Blueprint $table) {
			$table->id();
			$table->date('snapshot_date');
			$table->string('scope')->default('global');
			$table->unsignedInteger('jobs_warmed')->default(0);
			$table->unsignedInteger('success_count')->default(0);
			$table->unsignedInteger('failure_count')->default(0);
			$table->unsignedInteger('avg_duration_ms')->default(0);
			$table->unsignedInteger('p95_duration_ms')->default(0);
			$table->json('stats')->nullable();
			$table->timestamps();

			$table->unique(['snapshot_date', 'scope'], 'warmup_metric_snapshots_unique_scope');
		});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists('warmup_metric_snapshots');
	}
};

