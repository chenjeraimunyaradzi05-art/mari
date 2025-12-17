<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_follows')) {
            return;
        }

        Schema::create('social_follows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('follower_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->foreignId('following_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->boolean('is_close_friend')->default(false);
            $table->boolean('notifications_enabled')->default(true);
            $table->timestamp('followed_at');

            $table->unique(['follower_id', 'following_id']);
            $table->index(['follower_id', 'followed_at']);
            $table->index(['following_id', 'followed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_follows');
    }
};
