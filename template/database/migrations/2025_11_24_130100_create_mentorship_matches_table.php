<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('mentorship_matches')) {
            return;
        }

        Schema::create('mentorship_matches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mentorship_cohort_id')->nullable()->constrained('mentorship_cohorts')->nullOnDelete();
            $table->foreignId('mentorship_program_id')->nullable()->constrained('mentorship_programs')->nullOnDelete();
            $table->foreignId('mentor_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('mentee_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('mentor_profile_id')->nullable()->constrained('social_profiles')->nullOnDelete();
            $table->foreignId('mentee_profile_id')->nullable()->constrained('social_profiles')->nullOnDelete();
            $table->string('status')->default('active');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('next_check_in_at')->nullable();
            $table->json('context')->nullable();
            $table->timestamps();

            $table->index(['mentorship_cohort_id', 'status']);
            $table->index(['mentor_user_id', 'mentee_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mentorship_matches');
    }
};
