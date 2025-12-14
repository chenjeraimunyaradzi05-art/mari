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
		if (! Schema::hasTable('warmup_metric_events')) {
			return;
		}

		Schema::table('warmup_metric_events', function (Blueprint $table) {
			if (! Schema::hasColumn('warmup_metric_events', 'latency_bucket')) {
				$table->string('latency_bucket')->nullable()->after('duration_ms');
			}

			if (! Schema::hasColumn('warmup_metric_events', 'failure_code')) {
				$table->string('failure_code')->nullable()->after('status');
			}

			if (! Schema::hasColumn('warmup_metric_events', 'environment')) {
				$table->string('environment')->default('production')->after('failure_code');
			}

			if (! Schema::hasColumn('warmup_metric_events', 'tags')) {
				$table->json('tags')->nullable()->after('context');
			}

			if (! Schema::hasColumn('warmup_metric_events', 'metadata')) {
				$table->json('metadata')->nullable()->after('tags');
			}
		});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		if (! Schema::hasTable('warmup_metric_events')) {
			return;
		}

		Schema::table('warmup_metric_events', function (Blueprint $table) {
			$columns = [
				'latency_bucket',
				'failure_code',
				'environment',
				'tags',
				'metadata',
			];

			foreach ($columns as $column) {
				if (Schema::hasColumn('warmup_metric_events', $column)) {
					$table->dropColumn($column);
				}
			}
		});
	}
};

