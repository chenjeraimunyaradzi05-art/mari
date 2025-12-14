<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tax_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->date('purchase_date');
            $table->decimal('cost', 10, 2);
            $table->decimal('current_value', 10, 2)->nullable();
            $table->string('depreciation_type')->default('prime_cost'); // prime_cost, diminishing_value
            $table->decimal('depreciation_rate', 5, 2)->nullable(); // Percentage
            $table->string('serial_number')->nullable();
            $table->string('location')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tax_assets');
    }
};
