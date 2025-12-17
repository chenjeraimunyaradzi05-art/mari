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
            DB::statement("ALTER TABLE social_posts MODIFY COLUMN post_type ENUM('post', 'reel', 'story', 'article', 'poll', 'live_stream') NOT NULL");
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            // Warning: This will fail if there are rows with 'poll' or 'live_stream'
            DB::statement("ALTER TABLE social_posts MODIFY COLUMN post_type ENUM('post', 'reel', 'story', 'article') NOT NULL");
        }
    }
};
