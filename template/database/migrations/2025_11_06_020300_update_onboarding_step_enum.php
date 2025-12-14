<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement(
            "ALTER TABLE `users` MODIFY COLUMN `onboarding_step` ENUM('welcome','profile','roles','journey','completed') DEFAULT 'welcome'"
        );
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("UPDATE `users` SET `onboarding_step` = 'roles' WHERE `onboarding_step` = 'journey'");
        DB::statement(
            "ALTER TABLE `users` MODIFY COLUMN `onboarding_step` ENUM('welcome','profile','roles','completed') DEFAULT 'welcome'"
        );
    }
};
