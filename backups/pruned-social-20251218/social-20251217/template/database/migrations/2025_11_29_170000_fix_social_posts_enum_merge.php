<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            // Merging all required ENUM values from both Automotive/Social and Entertainment modules
            DB::statement("ALTER TABLE social_posts MODIFY COLUMN post_type ENUM('post', 'reel', 'story', 'article', 'poll', 'live_stream', 'movie', 'short_video', 'documentary', 'educational', 'success_story') NOT NULL DEFAULT 'post'");
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            // Reverting to the Entertainment module version (warning: data loss for polls/streams)
            DB::statement("ALTER TABLE social_posts MODIFY COLUMN post_type ENUM('post', 'reel', 'story', 'article', 'movie', 'short_video', 'documentary', 'educational', 'success_story') NOT NULL DEFAULT 'post'");
        }
    }
};
