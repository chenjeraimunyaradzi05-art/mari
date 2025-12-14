<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('connection_activity_logs')) {
            return;
        }

        Schema::create('connection_activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('target_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('connection_id')->nullable()->constrained('connections')->nullOnDelete();
            $table->string('action');
            $table->string('status')->nullable();
            $table->json('context')->nullable();
            $table->timestamps();

            $table->index(['actor_id', 'created_at']);
            $table->index(['target_user_id', 'created_at']);
            $table->index(['action', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('connection_activity_logs');
    }
};
