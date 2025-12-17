<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->string('author_type');
            $table->unsignedBigInteger('author_id');
            $table->text('body')->nullable();
            $table->string('media_path')->nullable();
            $table->enum('media_type', ['none','image','video'])->default('none');
            $table->enum('visibility', ['public','followers'])->default('public');
            $table->text('ai_caption')->nullable();
            $table->json('ai_tags')->nullable();
            $table->boolean('is_moderated')->default(false);
            $table->timestamps();
            $table->index(['author_type','author_id']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('posts');
    }
};
