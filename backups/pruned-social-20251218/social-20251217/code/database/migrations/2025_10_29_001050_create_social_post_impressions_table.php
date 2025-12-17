<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_post_impressions')) {
            return;
        }

        Schema::create('social_post_impressions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_post_id')->constrained('social_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('source', 40)->default('feed');
            $table->json('meta')->nullable();
            $table->timestamp('viewed_at')->useCurrent();
            $table->timestamps();

            $table->index(['social_post_id', 'viewed_at'], 'spi_post_viewed_idx');
            $table->index(['user_id', 'viewed_at'], 'spi_user_viewed_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_post_impressions');
    }
};
