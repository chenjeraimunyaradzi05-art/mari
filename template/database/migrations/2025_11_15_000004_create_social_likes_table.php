<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_likes')) {
            return;
        }

        Schema::create('social_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_profile_id')->constrained()->cascadeOnDelete();
            $table->morphs('likeable');
            $table->timestamp('liked_at');

            $table->unique(['social_profile_id', 'likeable_type', 'likeable_id'], 'social_likes_unique_like');
            $table->index(['likeable_type', 'likeable_id', 'liked_at'], 'social_likes_likeable_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_likes');
    }
};
