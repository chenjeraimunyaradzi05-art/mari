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
            $table->foreignId('follower_id')->constrained('users')->cascadeOnDelete();
            $table->morphs('followable');
            $table->timestamp('followed_at')->useCurrent();
            $table->timestamps();

            $table->unique(['follower_id', 'followable_type', 'followable_id'], 'social_follows_unique');
            $table->index(['followable_type', 'followable_id'], 'social_follows_followable_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_follows');
    }
};
