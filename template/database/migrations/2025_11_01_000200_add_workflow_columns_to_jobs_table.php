<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up(): void
	{
		$addedColumns = [
			'workflow_stage' => false,
			'workflow_status' => false,
		];

		Schema::table('jobs', function (Blueprint $table) use (&$addedColumns) {
			if (! Schema::hasColumn('jobs', 'workflow_stage')) {
				$table->string('workflow_stage', 50)
					->default('draft')
					->after('status');
				$addedColumns['workflow_stage'] = true;
			}

			if (! Schema::hasColumn('jobs', 'workflow_status')) {
				$table->string('workflow_status', 50)
					->default('pending_review')
					->after('workflow_stage');
				$addedColumns['workflow_status'] = true;
			}

			if (! Schema::hasColumn('jobs', 'workflow_priority')) {
				$table->string('workflow_priority', 20)
					->default('normal')
					->after('workflow_status');
			}

			if (! Schema::hasColumn('jobs', 'workflow_submitted_at')) {
				$table->timestamp('workflow_submitted_at')
					->nullable()
					->after('workflow_priority');
			}

			if (! Schema::hasColumn('jobs', 'workflow_reviewed_at')) {
				$table->timestamp('workflow_reviewed_at')
					->nullable()
					->after('workflow_submitted_at');
			}

			if (! Schema::hasColumn('jobs', 'workflow_last_transition_at')) {
				$table->timestamp('workflow_last_transition_at')
					->nullable()
					->after('workflow_reviewed_at');
			}

			if (! Schema::hasColumn('jobs', 'workflow_reviewer_id')) {
				$table->foreignId('workflow_reviewer_id')
					->nullable()
					->after('workflow_last_transition_at')
					->constrained('admins')
					->nullOnDelete();
			}

			if (! Schema::hasColumn('jobs', 'workflow_notes')) {
				$table->text('workflow_notes')
					->nullable()
					->after('workflow_reviewer_id');
			}

			if (! Schema::hasColumn('jobs', 'workflow_payload')) {
				$table->json('workflow_payload')
					->nullable()
					->after('workflow_notes');
			}

			if (! Schema::hasColumn('jobs', 'workflow_source')) {
				$table->string('workflow_source', 50)
					->default('dashboard')
					->after('workflow_payload');
			}

			if (! Schema::hasColumn('jobs', 'workflow_auto_publish_at')) {
				$table->timestamp('workflow_auto_publish_at')
					->nullable()
					->after('workflow_source');
			}

			if (! Schema::hasColumn('jobs', 'workflow_auto_archive_at')) {
				$table->timestamp('workflow_auto_archive_at')
					->nullable()
					->after('workflow_auto_publish_at');
			}
		});

		if (($addedColumns['workflow_stage'] ?? false) || ($addedColumns['workflow_status'] ?? false)) {
			DB::table('jobs')->update([
				'workflow_stage' => DB::raw("CASE\n\t\tWHEN status = 'active' THEN 'published'\n\t\tWHEN status = 'expired' THEN 'archived'\n\t\tELSE 'review'\n\tEND"),
				'workflow_status' => DB::raw("CASE\n\t\tWHEN status = 'active' THEN 'approved'\n\t\tWHEN status = 'expired' THEN 'approved'\n\t\tELSE 'pending_review'\n\tEND"),
				'workflow_priority' => DB::raw("COALESCE(workflow_priority, 'normal')"),
				'workflow_submitted_at' => DB::raw('COALESCE(workflow_submitted_at, created_at)'),
				'workflow_reviewed_at' => DB::raw("CASE\n\t\tWHEN status IN ('active', 'expired') THEN COALESCE(updated_at, created_at)\n\t\tELSE workflow_reviewed_at\n\tEND"),
				'workflow_last_transition_at' => DB::raw('COALESCE(workflow_last_transition_at, updated_at, created_at)'),
				'workflow_source' => DB::raw("COALESCE(workflow_source, 'dashboard')")
			]);
		}
	}

	public function down(): void
	{
		Schema::table('jobs', function (Blueprint $table) {
			if (Schema::hasColumn('jobs', 'workflow_reviewer_id')) {
				$table->dropForeign(['workflow_reviewer_id']);
			}
		});

		Schema::table('jobs', function (Blueprint $table) {
			$columns = [
				'workflow_auto_archive_at',
				'workflow_auto_publish_at',
				'workflow_source',
				'workflow_payload',
				'workflow_notes',
				'workflow_reviewer_id',
				'workflow_last_transition_at',
				'workflow_reviewed_at',
				'workflow_submitted_at',
				'workflow_priority',
				'workflow_status',
				'workflow_stage',
			];

			$existingColumns = [];

			foreach ($columns as $column) {
				if (Schema::hasColumn('jobs', $column)) {
					$existingColumns[] = $column;
				}
			}

			if ($existingColumns !== []) {
				$table->dropColumn($existingColumns);
			}
		});
	}
};

