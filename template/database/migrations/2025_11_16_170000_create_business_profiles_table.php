<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('business_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('slug')->unique();
            $table->string('venture_name')->nullable();
            $table->string('tagline')->nullable();
            $table->string('hero_theme')->default('blush');
            $table->string('focus_industry')->nullable();
            $table->string('stage')->default('idea');
            $table->string('team_size')->nullable();
            $table->string('revenue_range')->nullable();
            $table->string('market_focus')->nullable();
            $table->json('focus_pillars')->nullable();
            $table->json('support_needs')->nullable();
            $table->json('metrics')->nullable();
            $table->json('ai_snapshot')->nullable();
            $table->text('mission_statement')->nullable();
            $table->text('signature_offer')->nullable();
            $table->timestamp('last_ai_synced_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('business_profiles');
    }
};
