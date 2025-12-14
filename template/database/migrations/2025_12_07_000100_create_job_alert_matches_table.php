<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class() extends Migration
{
    public function up(): void
    {
        Schema::create('job_alert_matches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dream_job_alert_id')->constrained('dream_job_alerts')->onDelete('cascade');
            $table->foreignId('job_posting_id')->constrained('jobs')->onDelete('cascade');
            $table->integer('match_score'); // 0-100
            $table->json('match_reasons')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_alert_matches');
    }
};
