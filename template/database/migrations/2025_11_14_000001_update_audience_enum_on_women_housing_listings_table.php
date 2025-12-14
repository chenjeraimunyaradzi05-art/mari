<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement(<<<SQL
            ALTER TABLE women_housing_listings
            MODIFY audience ENUM('women_only','women_students','women_professionals','women_caregivers','women_retirees')
            DEFAULT 'women_only'
        SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement(<<<SQL
            ALTER TABLE women_housing_listings
            MODIFY audience ENUM('women_only','women_students','women_professionals')
            DEFAULT 'women_only'
        SQL);
    }
};
