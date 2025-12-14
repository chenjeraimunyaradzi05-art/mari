<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement(<<<SQL
            ALTER TABLE women_persona_profiles
            MODIFY persona ENUM('househunter','landlord','agent','investor','ally','student','entrepreneur') DEFAULT 'househunter'
        SQL);
    }

    public function down(): void
    {
        DB::statement(<<<SQL
            ALTER TABLE women_persona_profiles
            MODIFY persona ENUM('househunter','landlord','agent','investor','ally') DEFAULT 'househunter'
        SQL);
    }
};
