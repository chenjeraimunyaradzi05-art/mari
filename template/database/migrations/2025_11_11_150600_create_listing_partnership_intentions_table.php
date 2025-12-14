<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('listing_partnership_intentions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('women_housing_listing_id')->constrained()->cascadeOnDelete();
            $table->foreignId('initiator_user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('intent_type', ['co_rent', 'co_buy', 'co_develop'])->default('co_rent');
            $table->unsignedBigInteger('budget_range_min_cents')->nullable();
            $table->unsignedBigInteger('budget_range_max_cents')->nullable();
            $table->enum('preferred_finance_type', ['mortgage', 'cash', 'shared_equity', 'rent'])->nullable();
            $table->json('skills_offered')->nullable();
            $table->string('availability_window')->nullable();
            $table->enum('status', ['pending', 'matched', 'withdrawn', 'expired'])->default('pending');
            $table->binary('ai_match_vector')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['women_housing_listing_id', 'status'], 'listing_partnership_intentions_listing_status_idx');
            $table->index(['initiator_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_partnership_intentions');
    }
};
