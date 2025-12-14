<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('profiles')) {
            DB::statement("ALTER TABLE `profiles` MODIFY `persona_type` ENUM('personal','professional','creator','business','anonymous','mentor') NOT NULL DEFAULT 'personal'");
            DB::statement("ALTER TABLE `profiles` MODIFY `dm_policy` ENUM('public','everyone','followers','connections_only','trusted','mentors_only','no_one') NOT NULL DEFAULT 'everyone'");
            DB::statement("ALTER TABLE `profiles` MODIFY `tag_policy` ENUM('public','everyone','followers','connections_only','trusted','mentors_only','no_one') NOT NULL DEFAULT 'everyone'");
            DB::statement("ALTER TABLE `profiles` MODIFY `mention_policy` ENUM('public','everyone','followers','connections_only','trusted','mentors_only','no_one') NOT NULL DEFAULT 'everyone'");
        }

        if (Schema::hasTable('conversation_messages') && Schema::hasColumn('conversation_messages', 'sent_at')) {
            DB::statement("ALTER TABLE `conversation_messages` MODIFY `sent_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
        }
    }

    public function down(): void
    {
        // Forward-only migration. Revert by manually adjusting the columns if necessary.
    }
};
