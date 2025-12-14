<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('business_cashbook_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_cashbook_id')->constrained('business_cashbooks')->cascadeOnDelete();
            $table->date('date');
            $table->string('entry_type');
            $table->string('category')->nullable();
            $table->string('description')->nullable();
            $table->decimal('amount', 12, 2);
            $table->boolean('is_tax_deductible')->default(true);
            $table->string('ai_last_context_token')->nullable();
            $table->timestamp('ai_last_context_at')->nullable();
            $table->boolean('reviewed_by_ai')->default(false);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['business_cashbook_id', 'date']);
            $table->index(['entry_type', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_cashbook_entries');
    }
};
