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
        if (!Schema::hasTable('candidate_job_alerts')) {
            Schema::create('candidate_job_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained()->onDelete('cascade');
            $table->string('name')->nullable();
            $table->boolean('is_active')->default(true);

            // Alert preferences
            $table->json('keywords')->nullable(); // Job title keywords
            $table->json('job_categories')->nullable(); // Category IDs
            $table->json('job_types')->nullable(); // Job type IDs
            $table->json('job_roles')->nullable(); // Job role IDs
            $table->json('locations')->nullable(); // Location preferences
            $table->json('salary_range')->nullable(); // Min/max salary
            $table->json('experience_levels')->nullable(); // Experience level IDs

            // Notification settings
            $table->boolean('email_enabled')->default(true);
            $table->boolean('sms_enabled')->default(false);
            $table->boolean('push_enabled')->default(true);
            $table->string('frequency')->default('immediate'); // immediate, daily, weekly
            $table->time('preferred_time')->nullable(); // For daily/weekly
            $table->json('quiet_hours')->nullable(); // Start/end time for quiet period

            // AI learning
            $table->integer('match_threshold')->default(70); // Minimum match score
            $table->json('ai_preferences')->nullable(); // Learned preferences
            $table->integer('clicks_count')->default(0);
            $table->integer('applications_count')->default(0);
            $table->timestamp('last_sent_at')->nullable();

            $table->timestamps();

            // Indexes
            $table->index('candidate_id');
            $table->index(['is_active', 'frequency']);
        });

        Schema::create('job_alert_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_id')->constrained('candidate_job_alerts')->onDelete('cascade');
            $table->foreignId('job_id')->constrained()->onDelete('cascade');
            $table->foreignId('candidate_id')->constrained()->onDelete('cascade');
            $table->integer('match_score');
            $table->string('channel'); // email, sms, push
            $table->enum('status', ['sent', 'failed', 'clicked', 'applied'])->default('sent');
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('clicked_at')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            // Indexes
            $table->index(['alert_id', 'job_id']);
            $table->index(['candidate_id', 'status']);
            $table->index('sent_at');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('job_alert_logs');
        Schema::dropIfExists('candidate_job_alerts');
    }
};
