<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class() extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'notify_job_matches_email')) {
                $table->boolean('notify_job_matches_email')->default(true)->after('remember_token');
            }

            if (! Schema::hasColumn('users', 'notify_job_matches_in_app')) {
                $table->boolean('notify_job_matches_in_app')->default(true)->after('notify_job_matches_email');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'notify_job_matches_email')) {
                $table->dropColumn('notify_job_matches_email');
            }

            if (Schema::hasColumn('users', 'notify_job_matches_in_app')) {
                $table->dropColumn('notify_job_matches_in_app');
            }
        });
    }
};
