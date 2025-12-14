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
		if (! Schema::hasTable('warmup_metric_snapshots')) {
			return;
		}

		Schema::table('warmup_metric_snapshots', function (Blueprint $table) {
			if (! Schema::hasColumn('warmup_metric_snapshots', 'failure_rate')) {
				$table->decimal('failure_rate', 5, 2)->default(0)->after('failure_count');
			}

			if (! Schema::hasColumn('warmup_metric_snapshots', 'p99_duration_ms')) {
				$table->unsignedInteger('p99_duration_ms')->default(0)->after('p95_duration_ms');
			}

			if (! Schema::hasColumn('warmup_metric_snapshots', 'notes')) {
				$table->text('notes')->nullable()->after('stats');
			}

			if (! Schema::hasColumn('warmup_metric_snapshots', 'metadata')) {
				$table->json('metadata')->nullable()->after('notes');
			}
		});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		if (! Schema::hasTable('warmup_metric_snapshots')) {
			return;
		}

		Schema::table('warmup_metric_snapshots', function (Blueprint $table) {
			$columns = [
				'failure_rate',
				'p99_duration_ms',
				'notes',
				'metadata',
			];

			foreach ($columns as $column) {
				if (Schema::hasColumn('warmup_metric_snapshots', $column)) {
					$table->dropColumn($column);
				}
			}
		});
	}
};

