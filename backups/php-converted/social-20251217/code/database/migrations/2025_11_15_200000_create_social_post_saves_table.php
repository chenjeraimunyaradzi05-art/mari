<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_post_saves')) {
            return;
        }

        Schema::create('social_post_saves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('social_profile_id')->constrained()->cascadeOnDelete();
            $table->timestamp('saved_at')->useCurrent();
            $table->unique(['social_post_id', 'social_profile_id']);
            $table->index(['social_profile_id', 'saved_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_post_saves');
    }
};
