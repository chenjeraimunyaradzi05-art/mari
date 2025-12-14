<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'active_profile_id')) {
                $table->foreignId('active_profile_id')->nullable()->after('persona_flags')->constrained('profiles')->nullOnDelete();
            }

            if (!Schema::hasColumn('users', 'age_bracket')) {
                $table->enum('age_bracket', ['teen', 'adult', 'senior'])->nullable()->after('active_profile_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'active_profile_id')) {
                $table->dropConstrainedForeignId('active_profile_id');
            }

            if (Schema::hasColumn('users', 'age_bracket')) {
                $table->dropColumn('age_bracket');
            }
        });
    }
};
