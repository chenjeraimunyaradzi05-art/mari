<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_post_reactions')) {
            return;
        }

        Schema::create('social_post_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_post_id')->constrained('social_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('reaction', 30)->default('like');
            $table->timestamps();

            $table->unique(['social_post_id', 'user_id', 'reaction'], 'spr_unique_user_reaction');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_post_reactions');
    }
};
