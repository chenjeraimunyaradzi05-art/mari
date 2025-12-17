<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('social_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 64);
            $table->string('provider_id');
            $table->string('email')->nullable();
            $table->string('name')->nullable();
            $table->string('nickname')->nullable();
            $table->string('avatar')->nullable();
            $table->text('token')->nullable();
            $table->text('refresh_token')->nullable();
            $table->timestamp('token_expires_at')->nullable();
            $table->json('raw')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'provider_id']);
            $table->index('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_accounts');
    }
};
