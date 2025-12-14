<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('business_budget_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_budget_id')->constrained('business_budgets')->cascadeOnDelete();
            $table->string('line_type');
            $table->string('category')->nullable();
            $table->string('label')->nullable();
            $table->decimal('planned_amount', 12, 2)->default(0);
            $table->integer('sort_order')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['business_budget_id', 'line_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_budget_lines');
    }
};
