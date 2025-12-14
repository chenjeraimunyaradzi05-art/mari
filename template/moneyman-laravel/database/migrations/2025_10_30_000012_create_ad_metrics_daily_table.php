<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ad_metrics_daily', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained('ad_campaigns')->cascadeOnDelete();
            $table->date('date')->index();
            $table->unsignedBigInteger('impressions')->default(0);
            $table->unsignedBigInteger('clicks')->default(0);
            $table->unsignedBigInteger('views')->default(0);
            $table->unsignedBigInteger('watch_time_s')->default(0);
            $table->unsignedBigInteger('leads')->default(0);
            $table->unsignedBigInteger('cost_cents')->default(0);
            $table->timestamps();
            $table->unique(['campaign_id','date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ad_metrics_daily');
    }
};
