<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analytics_events', function (Blueprint $table) {
            $table->id();
            $table->string('event', 120);
            $table->json('properties')->nullable();
            $table->json('metadata')->nullable();
            $table->string('source')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();

            $table->index('event');
            $table->index('source');
            $table->index('received_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_events');
    }
};
