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
            $table->foreignId('social_profile_id')->constrained()->cascadeOnDelete();
            $table->enum('post_type', ['post', 'reel', 'story', 'article', 'poll', 'live_stream', 'movie', 'short_video', 'documentary', 'educational', 'success_story']);
            $table->text('caption')->nullable();
            $table->json('media')->nullable();
            $table->string('location')->nullable();
            $table->json('tags')->nullable();
            $table->json('mentions')->nullable();
            $table->integer('likes_count')->default(0);
            $table->integer('comments_count')->default(0);
            $table->integer('shares_count')->default(0);
            $table->integer('views_count')->default(0);
            $table->boolean('is_pinned')->default(false);
            $table->boolean('comments_disabled')->default(false);
            $table->enum('visibility', ['public', 'followers', 'private'])->default('public');
            $table->timestamp('published_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->float('ai_engagement_score')->default(0);
            $table->json('ai_tags')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['social_profile_id', 'published_at']);
            $table->index(['post_type', 'visibility']);

            if (Schema::getConnection()->getDriverName() === 'mysql') {
                $table->fullText(['caption']);
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_posts');
    }
};
