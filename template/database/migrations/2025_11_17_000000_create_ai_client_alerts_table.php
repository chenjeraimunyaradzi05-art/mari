<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ai_client_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('source');
            $table->string('severity')->default('warning');
            $table->text('message');
            $table->json('context')->nullable();
            $table->foreignId('admin_id')->nullable()->constrained('admins')->nullOnDelete();
            $table->string('ip', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamps();
            $table->index(['severity', 'acknowledged_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_client_alerts');
    }
};
