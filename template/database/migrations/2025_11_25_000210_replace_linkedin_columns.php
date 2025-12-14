<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('candidates')) {
            Schema::table('candidates', function (Blueprint $table) {
                if (! Schema::hasColumn('candidates', 'professional_profile_url')) {
                    $table->string('professional_profile_url')->nullable()->after('website');
                }
            });

            if (Schema::hasColumn('candidates', 'linkedin_url')) {
                DB::statement('UPDATE candidates SET professional_profile_url = linkedin_url WHERE professional_profile_url IS NULL');

                Schema::table('candidates', function (Blueprint $table) {
                    $table->dropColumn('linkedin_url');
                });
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('candidates')) {
            Schema::table('candidates', function (Blueprint $table) {
                if (! Schema::hasColumn('candidates', 'linkedin_url')) {
                    $table->string('linkedin_url')->nullable()->after('website');
                }
            });

            DB::statement('UPDATE candidates SET linkedin_url = professional_profile_url WHERE linkedin_url IS NULL');

            Schema::table('candidates', function (Blueprint $table) {
                if (Schema::hasColumn('candidates', 'professional_profile_url')) {
                    $table->dropColumn('professional_profile_url');
                }
            });
        }
    }
};
