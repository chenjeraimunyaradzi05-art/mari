<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('debt_submissions', function (Blueprint $table): void {
            $table->id();
            $table->foreignIdFor(User::class)->nullable()->constrained()->nullOnDelete();
            $table->string('profile_name')->nullable();
            $table->string('submission_source')->default('web');
            $table->json('debts');
            $table->json('scenarios')->nullable();
            $table->unsignedBigInteger('total_balance_cents');
            $table->unsignedBigInteger('current_payment_cents');
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('debt_submissions');
    }
};
