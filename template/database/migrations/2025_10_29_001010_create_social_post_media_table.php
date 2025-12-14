<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_post_media')) {
            return;
        }

        Schema::create('social_post_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_post_id')->constrained('social_posts')->cascadeOnDelete();
            $table->string('media_type', 30);
            $table->string('path');
            $table->json('meta')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();

            $table->index(['social_post_id', 'position'], 'spm_post_position_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_post_media');
    }
};
