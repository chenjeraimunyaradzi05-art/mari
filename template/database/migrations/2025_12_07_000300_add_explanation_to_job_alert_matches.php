<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class() extends Migration
{
    public function up(): void
    {
        Schema::table('job_alert_matches', function (Blueprint $table) {
            if (! Schema::hasColumn('job_alert_matches', 'explanation')) {
                $table->text('explanation')->nullable()->after('match_reasons');
            }
        });
    }

    public function down(): void
    {
        Schema::table('job_alert_matches', function (Blueprint $table) {
            if (Schema::hasColumn('job_alert_matches', 'explanation')) {
                $table->dropColumn('explanation');
            }
        });
    }
};
