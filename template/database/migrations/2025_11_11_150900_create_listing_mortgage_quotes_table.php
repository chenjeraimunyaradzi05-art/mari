<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	public function up(): void
	{
		Schema::create('listing_mortgage_quotes', function (Blueprint $table): void {
			$table->id();
			$table->foreignId('women_housing_listing_id')->constrained()->cascadeOnDelete();
			$table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
			$table->foreignId('mortgage_rate_snapshot_id')->constrained()->cascadeOnDelete();
			$table->unsignedBigInteger('principal_amount_cents');
			$table->unsignedBigInteger('deposit_amount_cents')->nullable();
			$table->unsignedSmallInteger('loan_term_months');
			$table->enum('repayment_frequency', ['monthly', 'fortnightly', 'weekly'])->default('monthly');
			$table->unsignedBigInteger('calculated_repayment_cents');
			$table->enum('risk_rating', ['low', 'medium', 'high'])->nullable();
			$table->text('ai_commentary')->nullable();
			$table->timestamp('generated_at')->useCurrent();
			$table->timestamps();

			$table->index(['women_housing_listing_id', 'generated_at'], 'listing_mortgage_quotes_listing_generated_idx');
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('listing_mortgage_quotes');
	}
};
