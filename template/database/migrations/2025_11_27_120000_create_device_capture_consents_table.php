<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('device_capture_consents')) {
            return;
        }

        Schema::create('device_capture_consents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('capture_type', 40);
            $table->string('context')->nullable();
            $table->string('consent_copy')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->timestamp('reminded_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'capture_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_capture_consents');
    }
};
