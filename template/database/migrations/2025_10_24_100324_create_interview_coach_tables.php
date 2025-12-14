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
        // Interview questions bank
        if (!Schema::hasTable('interview_questions')) {
            Schema::create('interview_questions', function (Blueprint $table) {
            $table->id();
            $table->string('question');
            $table->text('description')->nullable();
            $table->enum('type', ['behavioral', 'technical', 'situational', 'competency', 'case_study']);
            $table->enum('difficulty', ['entry', 'mid', 'senior', 'executive']);
            $table->foreignId('job_category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('job_role_id')->nullable()->constrained()->nullOnDelete();
            $table->json('keywords')->nullable(); // Skills/topics this question tests
            $table->text('sample_answer')->nullable(); // AI-generated sample answer
            $table->json('evaluation_criteria')->nullable(); // What to look for in answers
            $table->integer('time_limit')->default(300); // Seconds to answer
            $table->boolean('is_active')->default(true);
            $table->integer('usage_count')->default(0);
            $table->decimal('avg_score', 5, 2)->default(0);
            $table->timestamps();

            $table->index(['type', 'difficulty', 'is_active']);
            $table->index('job_category_id');
            $table->index('job_role_id');
        });

        // Interview practice sessions
        if (!Schema::hasTable('interview_sessions')) {
            Schema::create('interview_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained()->cascadeOnDelete();
            $table->string('title'); // e.g., "Senior Laravel Developer Practice"
            $table->enum('session_type', ['quick_practice', 'full_mock', 'focused_topic', 'custom']);
            $table->foreignId('job_category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('job_role_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('difficulty', ['entry', 'mid', 'senior', 'executive']);
            $table->integer('total_questions')->default(0);
            $table->integer('answered_questions')->default(0);
            $table->enum('status', ['in_progress', 'completed', 'abandoned'])->default('in_progress');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->integer('total_time_spent')->default(0); // Seconds
            $table->decimal('overall_score', 5, 2)->nullable();
            $table->json('ai_feedback')->nullable(); // Overall session feedback
            $table->json('strengths')->nullable(); // Areas candidate excelled
            $table->json('improvements')->nullable(); // Areas to improve
            $table->json('recommended_topics')->nullable(); // Topics to practice more
            $table->timestamps();

            $table->index(['candidate_id', 'status']);
            $table->index('created_at');
            });
        }

        // Individual answers in sessions
        if (!Schema::hasTable('interview_answers')) {
            Schema::create('interview_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('interview_question_id')->constrained()->cascadeOnDelete();
            $table->text('answer');
            $table->integer('time_taken')->default(0); // Seconds
            $table->decimal('score', 5, 2)->nullable(); // 0-100
            $table->json('ai_analysis')->nullable(); // Detailed AI feedback
            $table->json('strengths')->nullable(); // What was good
            $table->json('weaknesses')->nullable(); // What to improve
            $table->json('keywords_used')->nullable(); // Keywords candidate mentioned
            $table->json('keywords_missed')->nullable(); // Important keywords missed
            $table->integer('word_count')->default(0);
            $table->decimal('clarity_score', 5, 2)->nullable(); // How clear the answer was
            $table->decimal('relevance_score', 5, 2)->nullable(); // How relevant to question
            $table->decimal('depth_score', 5, 2)->nullable(); // How detailed
            $table->decimal('confidence_score', 5, 2)->nullable(); // Estimated confidence level
            $table->text('improvement_tip')->nullable(); // Specific tip for this answer
            $table->timestamps();

            $table->index('interview_session_id');
            $table->index('interview_question_id');
            });
        }

        // Question categories/topics for filtering
        Schema::create('interview_question_topics', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('icon')->default('fas fa-bookmark');
            $table->string('color')->default('#E91E8C');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            });
        }

        // Many-to-many relationship between questions and topics
        if (!Schema::hasTable('interview_question_topic')) {
            Schema::create('interview_question_topic', function (Blueprint $table) {
                $table->foreignId('interview_question_id')->constrained()->cascadeOnDelete();
                $table->foreignId('interview_question_topic_id')->constrained()->cascadeOnDelete();

                $table->primary(['interview_question_id', 'interview_question_topic_id'], 'iq_topic_primary');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('interview_question_topic');
        Schema::dropIfExists('interview_question_topics');
        Schema::dropIfExists('interview_answers');
        Schema::dropIfExists('interview_sessions');
        Schema::dropIfExists('interview_questions');
    }
};
