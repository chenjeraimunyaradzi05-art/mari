<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('social_metrics_daily')) {
            return;
        }

        Schema::table('social_metrics_daily', function (Blueprint $table) {
            if (! Schema::hasColumn('social_metrics_daily', 'cohort_tags')) {
                $table->json('cohort_tags')->nullable()->after('invite_funnel_bins');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('social_metrics_daily')) {
            return;
        }

        Schema::table('social_metrics_daily', function (Blueprint $table) {
            if (Schema::hasColumn('social_metrics_daily', 'cohort_tags')) {
                $table->dropColumn('cohort_tags');
            }
        });
    }
};
