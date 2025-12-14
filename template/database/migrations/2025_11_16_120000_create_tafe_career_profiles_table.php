<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tafe_career_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->text('motivations')->nullable();
            $table->json('focus_areas')->nullable();
            $table->json('preferred_sectors')->nullable();
            $table->string('salary_aspiration')->nullable();
            $table->text('impact_goals')->nullable();
            $table->string('work_style')->nullable();
            $table->json('top_skills')->nullable();
            $table->text('ai_summary')->nullable();
            $table->timestamp('ai_refreshed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tafe_career_profiles');
    }
};
