<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('opportunity_radar_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('opportunity_type');
            $table->unsignedBigInteger('opportunity_id')->nullable();
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->text('summary')->nullable();
            $table->unsignedTinyInteger('score')->default(0);
            $table->string('urgency_level')->default('steady');
            $table->json('fit_reasons')->nullable();
            $table->string('action_url')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('notified_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'opportunity_type']);
            $table->index(['opportunity_type', 'opportunity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('opportunity_radar_entries');
    }
};
