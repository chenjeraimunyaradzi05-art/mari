<?php

use App\Models\CourseIntake;
use App\Models\SubsidyProgram;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	/**
	 * Run the migrations.
	 */
	public function up(): void
	{
		Schema::create('course_intake_subsidy_program', function (Blueprint $table) {
			$table->id();
			$table->foreignIdFor(CourseIntake::class)
				->constrained()
				->cascadeOnDelete();
			$table->foreignIdFor(SubsidyProgram::class)
				->constrained()
				->cascadeOnDelete();
			$table->unsignedInteger('max_claims')->nullable();
			$table->enum('status', ['active', 'inactive'])->default('active');
			$table->text('notes')->nullable();
			$table->timestamps();

			$table->unique(['course_intake_id', 'subsidy_program_id'], 'course_intake_subsidy_unique');
		});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists('course_intake_subsidy_program');
	}
};
