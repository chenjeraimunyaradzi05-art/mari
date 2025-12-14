<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Modify the ENUM column to include new types
        // Note: DB::statement is required for modifying ENUMs in some DBs, or we can use change() if doctrine/dbal is installed.
        // Assuming MySQL/MariaDB
        DB::statement("ALTER TABLE social_posts MODIFY COLUMN post_type ENUM('post', 'reel', 'story', 'article', 'movie', 'short_video', 'documentary', 'educational', 'success_story') NOT NULL DEFAULT 'post'");
    }

    public function down(): void
    {
        // Revert to original ENUM
        // Warning: This might fail if there are rows with the new types.
        // For dev environment, we can skip or try to revert.
        // DB::statement("ALTER TABLE social_posts MODIFY COLUMN post_type ENUM('post', 'reel', 'story', 'article') NOT NULL");
    }
};
