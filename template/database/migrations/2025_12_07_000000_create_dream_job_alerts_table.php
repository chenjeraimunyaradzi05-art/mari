<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class() extends Migration
{
    public function up(): void
    {
        Schema::create('dream_job_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('job_title');
            $table->string('industry')->nullable();
            $table->string('location')->nullable();
            $table->decimal('min_salary', 10, 2)->nullable();
            $table->json('required_skills')->nullable();
            $table->enum('employment_type', ['full_time', 'part_time', 'contract', 'casual', 'apprenticeship', 'traineeship'])->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_matched_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dream_job_alerts');
    }
};
