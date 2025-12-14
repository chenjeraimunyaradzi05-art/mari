<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profile_badges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->constrained('profiles')->cascadeOnDelete();
            $table->enum('badge_type', ['verified', 'premium', 'impact_creator', 'certified_coach', 'trusted_host', 'mentor']);
            $table->enum('status', ['active', 'revoked', 'expired'])->default('active');
            $table->timestamp('awarded_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['profile_id', 'badge_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profile_badges');
    }
};
