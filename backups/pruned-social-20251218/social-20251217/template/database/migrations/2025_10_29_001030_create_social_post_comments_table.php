<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_post_comments')) {
            return;
        }

        Schema::create('social_post_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_post_id')->constrained('social_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('social_profile_id')->nullable()->index();
            $table->foreignId('parent_id')->nullable()->constrained('social_post_comments')->cascadeOnDelete();
            $table->text('content');
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['social_post_id', 'created_at'], 'spc_post_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_post_comments');
    }
};
