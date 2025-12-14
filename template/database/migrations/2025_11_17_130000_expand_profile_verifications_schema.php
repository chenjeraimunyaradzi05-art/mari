<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('profile_verifications', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('profile_id')->constrained()->nullOnDelete();
            $table->decimal('risk_score', 5, 2)->nullable()->after('status');
            $table->json('fraud_flags')->nullable()->after('risk_score');
            $table->json('attachment_manifest')->nullable()->after('submitted_data');
            $table->timestamp('submitted_at')->nullable()->after('attachment_manifest');
            $table->timestamp('decision_at')->nullable()->after('reviewed_at');
            $table->text('decision_reason')->nullable()->after('decision_at');
            $table->date('license_expires_at')->nullable()->after('decision_reason');
            $table->foreignId('assigned_reviewer_id')->nullable()->after('reviewed_by')->constrained('admins')->nullOnDelete();
            $table->index(['status', 'risk_score'], 'profile_verifications_status_risk_score_index');
            $table->index('assigned_reviewer_id', 'profile_verifications_assigned_reviewer_id_index');
            $table->index('license_expires_at', 'profile_verifications_license_expires_at_index');
        });

        Schema::create('verification_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('verification_id')->constrained('profile_verifications')->cascadeOnDelete();
            $table->string('disk', 100);
            $table->string('path');
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('checksum', 128)->nullable();
            $table->string('redacted_preview_path')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['verification_id', 'mime_type']);
        });

        Schema::create('verification_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('verification_id')->constrained('profile_verifications')->cascadeOnDelete();
            $table->string('action', 100);
            $table->foreignId('actor_id')->nullable()->constrained('admins')->nullOnDelete();
            $table->json('notes')->nullable();
            $table->json('ai_summary')->nullable();
            $table->timestamps();
            $table->index(['verification_id', 'action']);
        });

        Schema::create('verification_queue_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('verification_id')->constrained('profile_verifications')->cascadeOnDelete();
            $table->foreignId('assigned_reviewer_id')->constrained('admins')->cascadeOnDelete();
            $table->string('status', 50)->default('active');
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['assigned_reviewer_id', 'status']);
            $table->index(['verification_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('verification_queue_assignments');
        Schema::dropIfExists('verification_audits');
        Schema::dropIfExists('verification_documents');

        Schema::table('profile_verifications', function (Blueprint $table) {
            $table->dropIndex('profile_verifications_status_risk_score_index');
            $table->dropIndex('profile_verifications_assigned_reviewer_id_index');
            $table->dropIndex('profile_verifications_license_expires_at_index');

            $table->dropForeign(['assigned_reviewer_id']);
            $table->dropForeign(['user_id']);

            $table->dropColumn([
                'user_id',
                'risk_score',
                'fraud_flags',
                'attachment_manifest',
                'submitted_at',
                'decision_at',
                'decision_reason',
                'license_expires_at',
                'assigned_reviewer_id',
            ]);
        });
    }
};
