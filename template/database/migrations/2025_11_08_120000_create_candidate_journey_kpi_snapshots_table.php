<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up(): void
	{
		if (! Schema::hasTable('candidate_journey_kpi_snapshots')) {
			Schema::create('candidate_journey_kpi_snapshots', function (Blueprint $table): void {
				$table->id();
				$table->unsignedBigInteger('candidate_id');
				$table->date('snapshot_date');

				$table->unsignedSmallInteger('onboarding_progress')->default(0);
				$table->unsignedSmallInteger('profile_strength')->default(0);
				$table->unsignedSmallInteger('engagement_score')->default(0);
				$table->unsignedSmallInteger('support_actions_completed')->default(0);

				$table->json('milestone_flags')->nullable();
				$table->json('persona_alignment')->nullable();
				$table->json('ai_recommendation_uptake')->nullable();

				$table->timestamps();

				$table->unique(['candidate_id', 'snapshot_date'], 'candidate_journey_snapshot_unique');
				$table->index(['snapshot_date', 'onboarding_progress'], 'candidate_journey_snapshot_progress_idx');

				$table->foreign('candidate_id')
					->references('id')
					->on('candidates')
					->cascadeOnDelete();
			});
		}
	}

	public function down(): void
	{
		Schema::dropIfExists('candidate_journey_kpi_snapshots');
	}
};
