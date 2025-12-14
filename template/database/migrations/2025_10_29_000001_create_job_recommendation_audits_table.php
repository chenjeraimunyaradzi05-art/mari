<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('job_recommendation_audits')) {
            return;
        }

        Schema::create('job_recommendation_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained('candidates')->cascadeOnDelete();
            $table->unsignedSmallInteger('match_total')->default(0);
            $table->decimal('employer_diversity', 5, 4)->default(0);
            $table->decimal('role_diversity', 5, 4)->default(0);
            $table->decimal('location_diversity', 5, 4)->default(0);
            $table->decimal('average_score', 5, 2)->default(0);
            $table->decimal('score_variance', 7, 4)->default(0);
            $table->json('payload')->nullable();
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->index(['candidate_id', 'recorded_at'], 'jra_candidate_recorded_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_recommendation_audits');
    }
};
