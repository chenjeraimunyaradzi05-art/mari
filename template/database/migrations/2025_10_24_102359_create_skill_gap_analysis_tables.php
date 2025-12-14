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
        // Table to store skill gap analysis results
        if (!Schema::hasTable('skill_gap_analyses')) {
            Schema::create('skill_gap_analyses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained()->onDelete('cascade');
            $table->date('analysis_date');
            $table->decimal('overall_gap_score', 5, 2)->default(0); // Percentage score
            $table->json('skill_gaps')->nullable(); // Array of skills with gap details
            $table->json('market_insights')->nullable(); // Market demand insights
            $table->json('learning_paths')->nullable(); // Recommended learning paths
            $table->json('top_in_demand_skills')->nullable(); // Top skills in demand
            $table->json('skill_improvements')->nullable(); // Skills improved over time
            $table->integer('skills_analyzed')->default(0);
            $table->integer('skills_matched')->default(0);
            $table->integer('skills_gap')->default(0);
            $table->decimal('market_competitiveness', 5, 2)->default(0); // How competitive in market
            $table->string('career_level')->nullable(); // Based on skills
            $table->text('ai_recommendations')->nullable(); // AI-generated career advice
            $table->timestamps();

            $table->index('candidate_id');
            $table->index('analysis_date');
            });
        }

        // Table to store curated learning resources
        if (!Schema::hasTable('learning_resources')) {
            Schema::create('learning_resources', function (Blueprint $table) {
            $table->id();
            $table->foreignId('skill_id')->constrained()->onDelete('cascade');
            $table->string('title');
            $table->string('type'); // course, tutorial, book, video, article, certification
            $table->string('url')->nullable();
            $table->string('provider')->nullable(); // Udemy, Coursera, YouTube, etc.
            $table->integer('duration')->nullable(); // In minutes
            $table->string('difficulty'); // beginner, intermediate, advanced
            $table->decimal('rating', 3, 2)->nullable(); // 0-5 rating
            $table->text('description')->nullable();
            $table->decimal('price', 8, 2)->nullable(); // Cost (0 = free)
            $table->string('language')->default('English');
            $table->json('tags')->nullable(); // Additional tags
            $table->boolean('is_certified')->default(false); // Offers certification
            $table->boolean('is_featured')->default(false);
            $table->integer('enrollments')->default(0); // Track popularity
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('skill_id');
            $table->index('type');
            $table->index('difficulty');
            $table->index(['is_active', 'is_featured']);
            });
        }

        // Market skill demand and trend data
        if (!Schema::hasTable('skill_demand_data')) {
            Schema::create('skill_demand_data', function (Blueprint $table) {
                $table->id();
                $table->foreignId('skill_id')->constrained()->onDelete('cascade');
                $table->integer('job_count')->default(0); // Jobs requiring this skill
                $table->decimal('avg_salary', 10, 2)->nullable(); // Average salary
                $table->decimal('growth_rate', 5, 2)->default(0); // Year-over-year growth %
                $table->string('demand_level'); // low, medium, high, very_high
                $table->integer('demand_rank')->nullable(); // Ranking among all skills
                $table->json('top_industries')->nullable(); // Industries with highest demand
                $table->json('top_locations')->nullable(); // Locations with highest demand
                $table->json('related_skills')->nullable(); // Skills often paired with this
                $table->date('data_date'); // When data was collected
                                $table->timestamps();

                $table->unique(['skill_id', 'data_date']);
                $table->index('demand_level');
                $table->index('data_date');
            });
        }

        // Candidate's learning progress for recommended skills
        if (!Schema::hasTable('candidate_learning_progress')) {
            Schema::create('candidate_learning_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained()->onDelete('cascade');
            $table->foreignId('learning_resource_id')->constrained()->onDelete('cascade');
            $table->foreignId('skill_id')->constrained()->onDelete('cascade');
            $table->string('status'); // not_started, in_progress, completed, abandoned
            $table->integer('progress_percentage')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->integer('time_spent')->default(0); // In minutes
            $table->decimal('rating', 3, 2)->nullable(); // Candidate's rating
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('candidate_id');
            $table->index('status');
            $table->unique(['candidate_id', 'learning_resource_id'], 'candidate_resource_unique');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('candidate_learning_progress');
        Schema::dropIfExists('skill_demand_data');
        Schema::dropIfExists('learning_resources');
        Schema::dropIfExists('skill_gap_analyses');
    }
};
