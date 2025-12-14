<?php

use App\Models\ApprenticeshipCompetency;
use App\Models\Candidate;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	/**
	 * Run the migrations.
	 */
	public function up(): void
	{
		Schema::create('apprenticeship_progress_records', function (Blueprint $table) {
			$table->id();
			$table->foreignId('apprenticeship_competency_id');
			$table->foreignIdFor(Candidate::class)
				->constrained()
				->cascadeOnDelete();
			$table->foreignIdFor(User::class, 'assessed_by')
				->nullable()
				->constrained('users')
				->nullOnDelete();
			$table->enum('status', ['not_started', 'in_progress', 'completed', 'needs_review'])
				->default('not_started');
			$table->unsignedTinyInteger('proficiency')->nullable();
			$table->text('evidence')->nullable();
			$table->text('coach_notes')->nullable();
			$table->timestamp('started_at')->nullable();
			$table->timestamp('completed_at')->nullable();
			$table->timestamp('assessed_at')->nullable();
			$table->json('meta')->nullable();
			$table->timestamps();

			$table->unique(['apprenticeship_competency_id', 'candidate_id'], 'apprenticeship_progress_unique');
			$table->index(['candidate_id', 'status']);

			$table->foreign('apprenticeship_competency_id', 'apr_prog_comp_fk')
				->references('id')
				->on('apprenticeship_competencies')
				->cascadeOnDelete();
		});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists('apprenticeship_progress_records');
	}
};
