<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_posts')) {
            return;
        }

        Schema::create('social_posts', function (Blueprint $table) {
            $table->id();
            $table->morphs('postable');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30)->default('feed');
            $table->text('content')->nullable();
            $table->json('meta')->nullable();
            $table->string('visibility', 20)->default('public');
            $table->string('moderation_status', 30)->default('pending');
            $table->boolean('is_sponsored')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamp('pinned_at')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['user_id', 'published_at'], 'social_posts_user_published_idx');
            $table->index(['moderation_status', 'published_at'], 'social_posts_moderation_idx');
            $table->index(['is_sponsored', 'published_at'], 'social_posts_sponsored_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_posts');
    }
};
