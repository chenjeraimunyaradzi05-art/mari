<?php

use App\Models\ApprenticeshipProgram;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	/**
	 * Run the migrations.
	 */
	public function up(): void
	{
		Schema::create('apprenticeship_competencies', function (Blueprint $table) {
			$table->id();
			$table->foreignIdFor(ApprenticeshipProgram::class)
				->constrained()
				->cascadeOnDelete();
			$table->string('title');
			$table->string('slug')->nullable();
			$table->string('category')->nullable();
			$table->unsignedSmallInteger('sequence')->default(1);
			$table->unsignedTinyInteger('weight')->default(1);
			$table->text('description')->nullable();
			$table->text('expected_outcomes')->nullable();
			$table->json('meta')->nullable();
			$table->timestamps();
			$table->softDeletes();

			$table->unique(['apprenticeship_program_id', 'slug'], 'appr_program_slug_unique');
			$table->index(['apprenticeship_program_id', 'sequence'], 'appr_program_sequence_idx');
		});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists('apprenticeship_competencies');
	}
};
