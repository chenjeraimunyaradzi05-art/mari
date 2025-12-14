<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('cdn_latency_samples', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('latency_ms')->nullable();
            $table->unsignedSmallInteger('status_code')->nullable();
            $table->unsignedTinyInteger('attempts')->nullable();
            $table->string('failure_reason')->nullable();
            $table->unsignedTinyInteger('percentile_bucket')->nullable();
            $table->timestamp('recorded_at')->useCurrent();
            $table->timestamps();

            $table->index('recorded_at');
            $table->index('failure_reason');
            $table->index('percentile_bucket');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cdn_latency_samples');
    }
};
