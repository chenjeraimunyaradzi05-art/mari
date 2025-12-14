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
		if (Schema::hasTable('candidate_resume_snapshots')) {
			return;
		}

		Schema::create('candidate_resume_snapshots', function (Blueprint $table) {
			$table->id();
			$table->foreignId('candidate_id')->constrained()->cascadeOnDelete();
			$table->foreignId('candidate_cv_id')->nullable()->constrained('candidate_cvs')->nullOnDelete();
			$table->string('source')->nullable();
			$table->decimal('profile_score', 5, 2)->nullable();
			$table->decimal('ats_score', 5, 2)->nullable();
			$table->decimal('skill_coverage', 5, 2)->nullable();
			$table->decimal('experience_alignment', 5, 2)->nullable();
			$table->json('skills')->nullable();
			$table->json('education')->nullable();
			$table->json('experience')->nullable();
			$table->json('insights')->nullable();
			$table->json('metadata')->nullable();
			$table->string('resume_hash')->nullable();
			$table->timestamps();

			$table->index(['candidate_id', 'created_at']);
			$table->index(['candidate_cv_id', 'created_at']);
			$table->index('resume_hash');
		});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists('candidate_resume_snapshots');
	}
};
