<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('user_login_audits')) {
            return;
        }

        Schema::create('user_login_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('source', 40)->default('web');
            $table->string('timezone', 80)->nullable();
            $table->integer('offset_minutes')->nullable();
            $table->ipAddress('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamp('logged_in_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'logged_in_at']);
            $table->index('timezone');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_login_audits');
    }
};
