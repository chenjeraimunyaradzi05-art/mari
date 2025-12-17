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
            if (! Schema::hasColumn('social_metrics_daily', 'connection_heatmap_bins_30d')) {
                $table->json('connection_heatmap_bins_30d')->nullable()->after('connection_heatmap_bins');
            }

            if (! Schema::hasColumn('social_metrics_daily', 'primary_cohort')) {
                $table->string('primary_cohort', 64)->nullable()->after('cohort_tags');
            }

            $table->index(['captured_on', 'primary_cohort'], 'social_metrics_daily_primary_cohort_idx');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('social_metrics_daily')) {
            return;
        }

        Schema::table('social_metrics_daily', function (Blueprint $table) {
            if (Schema::hasColumn('social_metrics_daily', 'connection_heatmap_bins_30d')) {
                $table->dropColumn('connection_heatmap_bins_30d');
            }

            if (Schema::hasColumn('social_metrics_daily', 'primary_cohort')) {
                $table->dropIndex('social_metrics_daily_primary_cohort_idx');
                $table->dropColumn('primary_cohort');
            }
        });
    }
};
