<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_profile_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_profile_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('request_type', ['government_id', 'organization_email', 'document_upload']);
            $table->enum('status', ['pending', 'approved', 'rejected', 'needs_more_info'])->default('pending');
            $table->json('evidence_urls')->nullable();
            $table->json('attachments')->nullable();
            $table->text('notes')->nullable();
            $table->text('review_notes')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('admins')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'submitted_at']);
            $table->index(['social_profile_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_profile_verifications');
    }
};
