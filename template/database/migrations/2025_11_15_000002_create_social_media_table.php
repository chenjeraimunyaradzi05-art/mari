<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_media')) {
            return;
        }

        Schema::create('social_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_post_id')->constrained()->cascadeOnDelete();
            $table->string('media_type');
            $table->string('file_path');
            $table->string('thumbnail_path')->nullable();
            $table->string('mime_type');
            $table->integer('file_size')->nullable();
            $table->integer('width')->nullable();
            $table->integer('height')->nullable();
            $table->integer('duration')->nullable();
            $table->integer('order')->default(0);
            $table->json('ai_analysis')->nullable();
            $table->json('filters')->nullable();
            $table->timestamps();

            $table->index(['social_post_id', 'order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_media');
    }
};
