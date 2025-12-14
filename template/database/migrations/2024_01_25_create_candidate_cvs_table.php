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
        if (!Schema::hasTable('candidate_cvs')) {
            Schema::create('candidate_cvs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained('candidates')->onDelete('cascade');
            $table->string('title')->default('My Resume');
            $table->string('template')->default('modern'); // modern, classic, creative, minimal
            $table->string('slug')->unique();

            // Personal Information
            $table->text('professional_summary')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('website')->nullable();
            $table->string('linkedin')->nullable();
            $table->string('github')->nullable();
            $table->string('location')->nullable();

            // CV Sections (JSON)
            $table->json('work_experience')->nullable();
            $table->json('education')->nullable();
            $table->json('skills')->nullable();
            $table->json('certifications')->nullable();
            $table->json('projects')->nullable();
            $table->json('languages')->nullable();
            $table->json('achievements')->nullable();
            $table->json('custom_sections')->nullable();

            // AI & Cognitive Features
            $table->json('ai_suggestions')->nullable(); // Stored AI suggestions
            $table->integer('ats_score')->default(0); // Applicant Tracking System score
            $table->json('keyword_optimization')->nullable();
            $table->json('improvement_tips')->nullable();

            // Social Sharing
            $table->string('share_token')->unique()->nullable();
            $table->boolean('is_public')->default(false);
            $table->integer('view_count')->default(0);
            $table->integer('download_count')->default(0);
            $table->integer('share_count')->default(0);

            // File Management
            $table->string('pdf_path')->nullable();
            $table->timestamp('pdf_generated_at')->nullable();

            // Version Control
            $table->integer('version')->default(1);
            $table->boolean('is_active')->default(true);

            // SEO & Meta
            $table->string('meta_title')->nullable();
            $table->text('meta_description')->nullable();
            $table->string('og_image')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // Indexes
            $table->index('candidate_id');
            $table->index('slug');
            $table->index('share_token');
            $table->index('is_public');
            $table->index(['candidate_id', 'is_active']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('candidate_cvs');
    }
};
