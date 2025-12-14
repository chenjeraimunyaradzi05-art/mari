<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('women_cohort_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('persona')->default('learner');
            $table->json('financial_profile')->nullable();
            $table->json('education_profile')->nullable();
            $table->json('ai_insights')->nullable();
            $table->json('preferences')->nullable();
            $table->timestamps();

            $table->unique('user_id');
            $table->index('persona');
        });

        Schema::create('women_cohort_enrolments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('profile_id')->constrained('women_cohort_profiles')->cascadeOnDelete();
            $table->string('cohort_slug');
            $table->string('role')->default('learner');
            $table->string('status')->default('active');
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->timestamps();

            $table->unique(['profile_id', 'cohort_slug']);
            $table->index(['cohort_slug', 'status']);
        });

        Schema::create('women_partner_projects', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('status')->default('draft');
            $table->text('summary')->nullable();
            $table->json('capital_stack')->nullable();
            $table->json('ai_insights')->nullable();
            $table->timestamp('target_launch_at')->nullable();
            $table->timestamps();

            $table->index(['owner_id', 'status']);
        });

        Schema::create('women_partner_matches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained('women_partner_projects')->cascadeOnDelete();
            $table->foreignId('profile_id')->constrained('women_cohort_profiles')->cascadeOnDelete();
            $table->decimal('match_score', 5, 2)->nullable();
            $table->decimal('confidence', 5, 2)->nullable();
            $table->string('status')->default('pending');
            $table->json('notes')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'profile_id']);
            $table->index(['profile_id', 'status']);
        });

        Schema::create('women_goal_trackers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('profile_id')->constrained('women_cohort_profiles')->cascadeOnDelete();
            $table->string('goal_type');
            $table->decimal('target_amount', 14, 2)->nullable();
            $table->decimal('current_amount', 14, 2)->default(0);
            $table->decimal('progress_percent', 5, 2)->default(0);
            $table->timestamp('due_at')->nullable();
            $table->json('ai_nudges')->nullable();
            $table->timestamps();

            $table->index(['profile_id', 'goal_type']);
        });

        Schema::create('women_dashboard_preferences', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('persona')->nullable();
            $table->json('layout')->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });

        Schema::create('women_dashboard_widgets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('preference_id')->constrained('women_dashboard_preferences')->cascadeOnDelete();
            $table->string('widget');
            $table->unsignedInteger('position')->default(0);
            $table->boolean('pinned')->default(false);
            $table->json('config')->nullable();
            $table->timestamps();

            $table->unique(['preference_id', 'widget']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('women_dashboard_widgets');
        Schema::dropIfExists('women_dashboard_preferences');
        Schema::dropIfExists('women_goal_trackers');
        Schema::dropIfExists('women_partner_matches');
        Schema::dropIfExists('women_partner_projects');
        Schema::dropIfExists('women_cohort_enrolments');
        Schema::dropIfExists('women_cohort_profiles');
    }
};
