<?php

declare(strict_types=1);

use App\Models\BudgetProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('budget_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignIdFor(BudgetProfile::class)->constrained()->cascadeOnDelete();
            $table->date('transaction_date');
            $table->string('description');
            $table->string('reference')->nullable();
            $table->integer('amount_cents');
            $table->string('category_name');
            $table->string('category_type');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['transaction_date', 'category_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_transactions');
    }
};
