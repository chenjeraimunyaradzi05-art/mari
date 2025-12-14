<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('bank_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('bank_account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('posted_at');
            $table->string('description');
            $table->string('reference')->nullable();
            $table->integer('amount_cents');
            $table->enum('direction', ['credit', 'debit'])->default('debit');
            $table->string('status', 24)->default('pending');
            $table->string('category_key', 80)->nullable();
            $table->json('ai_suggestions')->nullable();
            $table->boolean('is_flagged')->default(false);
            $table->timestamp('reviewed_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'posted_at']);
            $table->index(['status', 'category_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_transactions');
    }
};
