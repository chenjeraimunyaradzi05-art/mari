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
        // Table to store candidate points and levels
        if (! Schema::hasTable('candidate_points')) {
            Schema::create('candidate_points', function (Blueprint $table) {
                $table->id();
                $table->foreignId('candidate_id')->constrained()->onDelete('cascade');
                $table->integer('total_points')->default(0);
                $table->integer('current_level')->default(1);
                $table->integer('points_to_next_level')->default(100);
                $table->integer('lifetime_points')->default(0); // Never decreases
                $table->integer('monthly_points')->default(0);
                $table->integer('weekly_points')->default(0);
                $table->date('last_monthly_reset')->nullable();
                $table->date('last_weekly_reset')->nullable();
                $table->integer('streak_days')->default(0); // Consecutive days active
                $table->date('last_activity_date')->nullable();
                $table->timestamps();

                $table->unique('candidate_id');
                $table->index('total_points');
                $table->index('current_level');
            });
        }

        // Table to store point transactions/history
        if (! Schema::hasTable('point_transactions')) {
            Schema::create('point_transactions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('candidate_id')->constrained()->onDelete('cascade');
                $table->string('action'); // profile_complete, job_applied, skill_learned, etc.
                $table->integer('points');
                $table->string('description');
                $table->json('metadata')->nullable(); // Additional context
                $table->timestamps();

                $table->index('candidate_id');
                $table->index('action');
                $table->index('created_at');
            });
        }

        // Table to store available badges
        if (! Schema::hasTable('badges')) {
            Schema::create('badges', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('slug')->unique();
                $table->text('description');
                $table->string('icon'); // Font Awesome icon class
                $table->string('color'); // Hex color
                $table->string('category'); // achievement, skill, activity, special
                $table->string('rarity'); // common, rare, epic, legendary
                $table->json('criteria'); // Requirements to earn
                $table->integer('points_reward')->default(0);
                $table->boolean('is_active')->default(true);
                $table->integer('earned_count')->default(0); // How many times earned
                $table->timestamps();

                $table->index('category');
                $table->index('rarity');
            });
        }

        // Table to store candidate earned badges
        if (! Schema::hasTable('candidate_badges')) {
            Schema::create('candidate_badges', function (Blueprint $table) {
                $table->id();
                $table->foreignId('candidate_id')->constrained()->onDelete('cascade');
                $table->foreignId('badge_id')->constrained()->onDelete('cascade');
                $table->timestamp('earned_at');
                $table->integer('progress_percentage')->default(100); // For progressive badges
                $table->json('progress_data')->nullable(); // Track progress toward earning
                $table->boolean('is_showcased')->default(false); // Display on profile
                $table->timestamps();

                $table->unique(['candidate_id', 'badge_id']);
                $table->index('candidate_id');
                $table->index('earned_at');
            });
        }

        // Table to store challenges
        if (! Schema::hasTable('challenges')) {
            Schema::create('challenges', function (Blueprint $table) {
                $table->id();
                $table->string('title');
                $table->string('slug')->unique();
                $table->text('description');
                $table->string('type'); // daily, weekly, monthly, special
                $table->string('category'); // application, learning, profile, engagement
                $table->json('requirements'); // What needs to be done
                $table->integer('target_value'); // Goal (e.g., apply to 5 jobs)
                $table->integer('points_reward');
                $table->foreignId('badge_id')->nullable()->constrained()->onDelete('set null'); // Optional badge reward
                $table->string('difficulty'); // easy, medium, hard
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->boolean('is_active')->default(true);
                $table->boolean('is_repeatable')->default(false);
                $table->integer('participants_count')->default(0);
                $table->integer('completions_count')->default(0);
                $table->timestamps();

                $table->index('type');
                $table->index('category');
                $table->index(['is_active', 'start_date', 'end_date']);
            });
        }

        // Table to track candidate challenge progress
        if (! Schema::hasTable('candidate_challenges')) {
            Schema::create('candidate_challenges', function (Blueprint $table) {
                $table->id();
                $table->foreignId('candidate_id')->constrained()->onDelete('cascade');
                $table->foreignId('challenge_id')->constrained()->onDelete('cascade');
                $table->string('status'); // in_progress, completed, failed, expired
                $table->integer('current_progress')->default(0);
                $table->integer('target_value');
                $table->integer('progress_percentage')->default(0);
                $table->timestamp('started_at');
                $table->timestamp('completed_at')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->json('progress_data')->nullable(); // Track detailed progress
                $table->timestamps();

                $table->index('candidate_id');
                $table->index('status');
                $table->index(['candidate_id', 'challenge_id']);
            });
        }

        // Table for leaderboard rankings (cached/computed)
        if (! Schema::hasTable('leaderboard_rankings')) {
            Schema::create('leaderboard_rankings', function (Blueprint $table) {
                $table->id();
                $table->string('leaderboard_type'); // all_time, monthly, weekly, category
                $table->foreignId('candidate_id')->constrained()->onDelete('cascade');
                $table->integer('rank');
                $table->integer('points');
                $table->integer('level')->nullable();
                $table->integer('badges_count')->nullable();
                $table->integer('challenges_completed')->nullable();
                $table->json('metadata')->nullable(); // Additional stats
                $table->date('period_start')->nullable();
                $table->date('period_end')->nullable();
                $table->timestamps();

                $table->index(['leaderboard_type', 'rank']);
                $table->index(['candidate_id', 'leaderboard_type']);
            });
        }

        // Table to store milestones
        if (!Schema::hasTable('milestones')) {
            Schema::create('milestones', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->text('description');
                $table->string('category'); // points, level, badges, applications, skills
                $table->integer('threshold'); // Value to reach (e.g., 1000 points)
                $table->integer('points_reward')->default(0);
                $table->foreignId('badge_id')->nullable()->constrained()->onDelete('set null');
                $table->string('icon');
                $table->string('color');
                $table->boolean('is_active')->default(true);
                $table->integer('achieved_count')->default(0);
                $table->timestamps();

                $table->index('category');
            });
        }

        // Table to track candidate milestone achievements
        if (!Schema::hasTable('candidate_milestones')) {
            Schema::create('candidate_milestones', function (Blueprint $table) {
                $table->id();
                $table->foreignId('candidate_id')->constrained()->onDelete('cascade');
                $table->foreignId('milestone_id')->constrained()->onDelete('cascade');
                $table->timestamp('achieved_at');
                $table->integer('value_at_achievement'); // Actual value when achieved
                $table->timestamps();

                $table->unique(['candidate_id', 'milestone_id']);
                $table->index('candidate_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('candidate_milestones');
        Schema::dropIfExists('milestones');
        Schema::dropIfExists('leaderboard_rankings');
        Schema::dropIfExists('candidate_challenges');
        Schema::dropIfExists('challenges');
        Schema::dropIfExists('candidate_badges');
        Schema::dropIfExists('badges');
        Schema::dropIfExists('point_transactions');
        Schema::dropIfExists('candidate_points');
    }
};
