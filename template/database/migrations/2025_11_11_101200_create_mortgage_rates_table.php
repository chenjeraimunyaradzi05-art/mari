<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('mortgage_rates', function (Blueprint $table) {
            $table->id();
            $table->string('lender_name');
            $table->string('product_name')->nullable();
            $table->enum('rate_type', ['fixed', 'variable', 'introductory', 'interest_only', 'line_of_credit'])->default('fixed');
            $table->unsignedSmallInteger('term_months')->nullable();
            $table->decimal('interest_rate', 5, 3);
            $table->decimal('comparison_rate', 5, 3)->nullable();
            $table->decimal('apr', 5, 3)->nullable();
            $table->decimal('max_lvr', 5, 2)->nullable();
            $table->unsignedBigInteger('min_loan_amount')->nullable();
            $table->unsignedBigInteger('max_loan_amount')->nullable();
            $table->date('effective_date');
            $table->date('expiry_date')->nullable();
            $table->json('features')->nullable();
            $table->json('eligibility_criteria')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['lender_name', 'rate_type']);
            $table->index(['rate_type', 'term_months']);
            $table->index(['effective_date', 'expiry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mortgage_rates');
    }
};
