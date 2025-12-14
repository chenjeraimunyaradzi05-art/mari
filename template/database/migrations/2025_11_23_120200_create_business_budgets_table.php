<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('business_budgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_cashbook_id')->constrained('business_cashbooks')->cascadeOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->string('title')->nullable();
            $table->string('currency', 12)->default('AUD');
            $table->boolean('auto_rollover')->default(false);
            $table->timestamps();

            $table->index(['business_cashbook_id', 'period_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_budgets');
    }
};
