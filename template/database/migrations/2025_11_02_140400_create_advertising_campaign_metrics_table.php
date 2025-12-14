<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('advertising_campaign_metrics')) {
            return;
        }

        Schema::create('advertising_campaign_metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained('advertising_campaigns')->cascadeOnDelete();
            $table->date('recorded_at');
            $table->unsignedBigInteger('impressions')->default(0);
            $table->unsignedBigInteger('clicks')->default(0);
            $table->unsignedInteger('conversions')->default(0);
            $table->unsignedInteger('qualified_leads')->default(0);
            $table->unsignedBigInteger('spend_cents')->default(0);
            $table->decimal('pipeline_value', 12, 2)->default(0);
            $table->json('notes')->nullable();
            $table->timestamps();

            $table->unique(['campaign_id', 'recorded_at'], 'adv_campaign_metrics_unique_day');
            $table->index(['recorded_at'], 'adv_campaign_metrics_recorded_idx');
            $table->index(['campaign_id', 'impressions'], 'adv_campaign_metrics_impressions_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('advertising_campaign_metrics');
    }
};
