<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('advertising_creatives')) {
            return;
        }

        Schema::create('advertising_creatives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_id')->constrained('advertising_campaigns')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('format', 40);
            $table->string('status', 40)->default('draft');
            $table->string('review_status', 40)->default('pending');
            $table->string('headline', 150)->nullable();
            $table->text('primary_text')->nullable();
            $table->string('cta_label', 60)->nullable();
            $table->string('destination_url', 2048)->nullable();
            $table->string('preview_image_url', 2048)->nullable();
            $table->string('preview_video_url', 2048)->nullable();
            $table->json('insights')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['campaign_id', 'status'], 'adv_creatives_campaign_status_idx');
            $table->index(['company_id', 'format'], 'adv_creatives_company_format_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('advertising_creatives');
    }
};
