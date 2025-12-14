<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('life_pathways', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('goal_key');
            $table->string('status')->default('draft');
            $table->unsignedTinyInteger('confidence_score')->default(0);
            $table->unsignedTinyInteger('impact_score')->default(0);
            $table->unsignedSmallInteger('total_duration_weeks')->nullable();
            $table->decimal('total_cost_aud', 12, 2)->nullable();
            $table->string('urgency_label')->default('steady');
            $table->text('summary')->nullable();
            $table->json('focus_areas')->nullable();
            $table->json('ai_context')->nullable();
            $table->json('metrics')->nullable();
            $table->timestamp('cached_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'goal_key']);
        });

        Schema::create('pathway_phases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('life_pathway_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('sequence');
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('estimated_duration_weeks')->nullable();
            $table->decimal('estimated_cost_aud', 12, 2)->nullable();
            $table->string('readiness_state')->default('planned');
            $table->string('mentor_type')->nullable();
            $table->string('support_level')->nullable();
            $table->unsignedTinyInteger('impact_weight')->default(0);
            $table->json('dependencies')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['life_pathway_id', 'sequence']);
        });

        Schema::create('pathway_milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pathway_phase_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('sequence');
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('due_on')->nullable();
            $table->string('status')->default('planned');
            $table->unsignedTinyInteger('progress')->default(0);
            $table->text('blockers')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['pathway_phase_id', 'sequence']);
        });

        Schema::create('pathway_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('source_type');
            $table->unsignedBigInteger('source_id');
            $table->string('target_type');
            $table->unsignedBigInteger('target_id');
            $table->unsignedTinyInteger('connection_score')->default(0);
            $table->unsignedSmallInteger('estimated_duration_weeks')->nullable();
            $table->decimal('estimated_cost_aud', 12, 2)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['source_type', 'source_id']);
            $table->index(['target_type', 'target_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pathway_connections');
        Schema::dropIfExists('pathway_milestones');
        Schema::dropIfExists('pathway_phases');
        Schema::dropIfExists('life_pathways');
    }
};
