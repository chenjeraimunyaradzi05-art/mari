<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('admin_login_audits')) {
            return;
        }

        Schema::create('admin_login_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('admins')->cascadeOnDelete();
            $table->string('source', 40)->default('admin');
            $table->string('timezone', 80)->nullable();
            $table->integer('offset_minutes')->nullable();
            $table->ipAddress('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamp('logged_in_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['admin_id', 'logged_in_at']);
            $table->index('timezone');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_login_audits');
    }
};
