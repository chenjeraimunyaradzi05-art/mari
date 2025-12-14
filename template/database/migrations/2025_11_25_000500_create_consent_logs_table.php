<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('consent_logs')) {
            return;
        }

        Schema::create('consent_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('surface');
            $table->string('action');
            $table->nullableMorphs('subject');
            $table->json('payload')->nullable();
            $table->string('actor_name')->nullable();
            $table->string('actor_email')->nullable();
            $table->string('actor_ip', 45)->nullable();
            $table->string('actor_user_agent')->nullable();
            $table->timestamp('logged_at')->useCurrent();
            $table->timestamps();

            $table->index(['surface', 'action'], 'consent_logs_surface_action_index');
            $table->index('logged_at', 'consent_logs_logged_at_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consent_logs');
    }
};
