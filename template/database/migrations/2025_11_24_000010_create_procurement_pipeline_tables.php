<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('procurement_opportunities', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('public_sector_agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->string('reference_code')->nullable();
            $table->string('category')->nullable();
            $table->string('pipeline_stage')->default('discovery');
            $table->string('status')->default('draft');
            $table->string('budget_band')->nullable();
            $table->string('priority_level')->default('standard');
            $table->string('compliance_risk')->default('medium');
            $table->string('delivery_region')->nullable();
            $table->json('supplier_diversity_targets')->nullable();
            $table->json('key_dates')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('opens_at')->nullable();
            $table->timestamp('closes_at')->nullable();
            $table->boolean('is_published')->default(false);
            $table->timestamps();
        });

        Schema::create('mission_briefs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('procurement_opportunity_id')->constrained()->cascadeOnDelete();
            $table->string('headline')->nullable();
            $table->text('executive_summary')->nullable();
            $table->text('problem_statement')->nullable();
            $table->json('mission_objectives')->nullable();
            $table->json('policy_links')->nullable();
            $table->json('impact_metrics')->nullable();
            $table->json('readiness_flags')->nullable();
            $table->json('collaboration_notes')->nullable();
            $table->json('attachments')->nullable();
            $table->string('ai_context_surface')->default('public-sector-mission');
            $table->timestamps();
        });

        Schema::create('compliance_trackers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('procurement_opportunity_id')->constrained()->cascadeOnDelete();
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->string('status')->default('pending');
            $table->json('checklist')->nullable();
            $table->json('evidence_links')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('civic_opportunity_signups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('procurement_opportunity_id')->constrained()->cascadeOnDelete();
            $table->foreignId('mission_brief_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status')->default('registered');
            $table->text('motivation')->nullable();
            $table->json('availability')->nullable();
            $table->json('preferences')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'procurement_opportunity_id'], 'civic_signups_unique_user_opportunity');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('civic_opportunity_signups');
        Schema::dropIfExists('compliance_trackers');
        Schema::dropIfExists('mission_briefs');
        Schema::dropIfExists('procurement_opportunities');
    }
};
