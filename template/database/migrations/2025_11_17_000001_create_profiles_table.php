<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('profiles')) {
            return;
        }

        Schema::create('profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('persona_type', ['personal', 'professional', 'creator', 'business', 'anonymous', 'mentor'])->default('personal');
            $table->string('display_name');
            $table->string('handle')->unique();
            $table->text('bio')->nullable();
            $table->string('avatar_path')->nullable();
            $table->string('cover_path')->nullable();
            $table->string('pronouns')->nullable();
            $table->string('location')->nullable();
            $table->string('gender')->nullable();
            $table->enum('age_bracket', ['teen', 'adult', 'senior'])->index();
            $table->boolean('women_safety_mode')->default(false);
            $table->enum('privacy_level', ['public', 'followers', 'private'])->default('public');
            $table->enum('dm_policy', ['public', 'everyone', 'followers', 'connections_only', 'trusted', 'mentors_only', 'no_one'])->default('everyone');
            $table->enum('tag_policy', ['public', 'everyone', 'followers', 'connections_only', 'trusted', 'mentors_only', 'no_one'])->default('everyone');
            $table->enum('mention_policy', ['public', 'everyone', 'followers', 'connections_only', 'trusted', 'mentors_only', 'no_one'])->default('everyone');
            $table->enum('location_visibility', ['public', 'followers', 'trusted_contacts', 'hidden'])->default('public');
            $table->json('goals')->nullable();
            $table->json('interests')->nullable();
            $table->json('skills')->nullable();
            $table->json('health_interests')->nullable();
            $table->json('safety_overrides')->nullable();
            $table->boolean('is_primary')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_safety_mode_applied_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'persona_type']);
            $table->index('privacy_level');
            $table->index('women_safety_mode');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profiles');
    }
};
