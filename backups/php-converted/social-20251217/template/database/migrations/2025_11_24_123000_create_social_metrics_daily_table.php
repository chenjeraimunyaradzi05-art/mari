<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_metrics_daily', function (Blueprint $table) {
            $table->id();
            $table->date('captured_on');
            $table->foreignId('persona_id')
                ->nullable()
                ->constrained('profiles')
                ->nullOnDelete();
            $table->unsignedInteger('total_connections')->default(0);
            $table->unsignedInteger('total_invites_sent')->default(0);
            $table->unsignedInteger('total_invites_accepted')->default(0);
            $table->decimal('messaging_civility_score', 5, 2)->nullable();
            $table->json('connection_heatmap_bins')->nullable();
            $table->json('invite_funnel_bins')->nullable();
            $table->timestamps();

            $table->unique(['captured_on', 'persona_id'], 'social_metrics_daily_date_persona_unique');
            $table->index(['captured_on', 'persona_id'], 'social_metrics_daily_date_persona_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_metrics_daily');
    }
};
