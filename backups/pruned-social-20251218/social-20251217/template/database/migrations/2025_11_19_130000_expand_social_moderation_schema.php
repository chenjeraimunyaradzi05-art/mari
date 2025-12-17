<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_sensitive_terms', function (Blueprint $table) {
            $table->id();
            $table->string('term');
            $table->string('severity')->default('low');
            $table->string('replacement')->nullable();
            $table->json('tags')->nullable();
            $table->json('contexts')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('admins')->nullOnDelete();
            $table->timestamps();

            $table->index(['term']);
            $table->index(['severity']);
        });

        Schema::create('social_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_profile_id')->nullable()->constrained('social_profiles')->nullOnDelete();
            $table->morphs('reportable');
            $table->string('category');
            $table->string('severity')->default('low');
            $table->text('description')->nullable();
            $table->enum('status', ['open', 'triage', 'under_review', 'action_taken', 'dismissed', 'escalated'])->default('open');
            $table->text('resolution_notes')->nullable();
            $table->foreignId('reviewer_id')->nullable()->constrained('admins')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['status']);
            $table->index(['category']);
            $table->index(['severity']);
        });

        Schema::create('social_enforcement_actions', function (Blueprint $table) {
            $table->id();
            $table->morphs('subject');
            $table->string('action_type');
            $table->string('reason')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['scheduled', 'active', 'expired', 'lifted'])->default('scheduled');
            $table->timestamp('takes_effect_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->foreignId('issued_by')->nullable()->constrained('admins')->nullOnDelete();
            $table->string('issued_by_type')->default('system');
            $table->foreignId('report_id')->nullable()->constrained('social_reports')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['action_type']);
            $table->index(['status']);
        });

        Schema::create('social_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('blocker_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->foreignId('blocked_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->enum('source', ['user', 'moderator', 'system'])->default('user');
            $table->string('reason')->nullable();
            $table->enum('status', ['active', 'expired', 'lifted'])->default('active');
            $table->timestamp('expires_at')->nullable();
            $table->foreignId('enforcement_action_id')->nullable()->constrained('social_enforcement_actions')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['blocker_profile_id', 'blocked_profile_id']);
            $table->index(['status']);
        });

        Schema::create('social_transparency_logs', function (Blueprint $table) {
            $table->id();
            $table->nullableMorphs('actor');
            $table->morphs('subject');
            $table->string('action');
            $table->string('decision')->nullable();
            $table->text('rationale')->nullable();
            $table->enum('visibility', ['internal', 'public'])->default('internal');
            $table->json('metadata')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['action']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_transparency_logs');
        Schema::dropIfExists('social_blocks');
        Schema::dropIfExists('social_enforcement_actions');
        Schema::dropIfExists('social_reports');
        Schema::dropIfExists('social_sensitive_terms');
    }
};
