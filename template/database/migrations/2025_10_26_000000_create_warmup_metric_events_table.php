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
		if (Schema::hasTable('warmup_metric_events')) {
			return;
		}

		Schema::create('warmup_metric_events', function (Blueprint $table) {
			$table->id();
			$table->foreignId('job_id')->nullable()->constrained()->cascadeOnDelete();
			$table->foreignId('candidate_id')->nullable()->constrained()->cascadeOnDelete();
			$table->string('warmable_type')->nullable();
			$table->unsignedBigInteger('warmable_id')->nullable();
			$table->string('action')->default('warm_job_matches');
			$table->string('status')->default('success');
			$table->unsignedInteger('duration_ms')->nullable();
			$table->unsignedSmallInteger('attempts')->default(1);
			$table->timestamp('started_at')->nullable();
			$table->timestamp('finished_at')->nullable();
			$table->json('context')->nullable();
			$table->text('error_message')->nullable();
			$table->timestamps();

			$table->index(['warmable_type', 'warmable_id'], 'warmup_metric_events_warmable_index');
			$table->index(['status', 'created_at'], 'warmup_metric_events_status_created_index');
			$table->index(['job_id', 'candidate_id'], 'warmup_metric_events_job_candidate_index');
		});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists('warmup_metric_events');
	}
};

