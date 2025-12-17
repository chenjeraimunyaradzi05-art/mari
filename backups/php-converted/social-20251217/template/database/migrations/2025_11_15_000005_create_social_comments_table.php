<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_comments')) {
            return;
        }

        Schema::create('social_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('social_profile_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('social_comments')->cascadeOnDelete();
            $table->text('content');
            $table->json('mentions')->nullable();
            $table->integer('likes_count')->default(0);
            $table->integer('replies_count')->default(0);
            $table->boolean('is_pinned')->default(false);
            $table->json('ai_sentiment')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['social_post_id', 'created_at']);
            $table->index(['parent_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_comments');
    }
};
