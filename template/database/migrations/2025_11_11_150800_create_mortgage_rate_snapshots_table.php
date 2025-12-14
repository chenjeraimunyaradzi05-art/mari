<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	public function up(): void
	{
		Schema::create('mortgage_rate_snapshots', function (Blueprint $table): void {
			$table->id();
			$table->string('provider');
			$table->string('product_name');
			$table->enum('rate_type', ['fixed', 'variable', 'split', 'introductory'])->default('fixed');
			$table->unsignedSmallInteger('term_months');
			$table->decimal('interest_rate', 5, 3);
			$table->decimal('comparison_rate', 5, 3)->nullable();
			$table->decimal('apr', 5, 3)->nullable();
			$table->unsignedTinyInteger('max_lvr')->nullable();
			$table->unsignedTinyInteger('min_deposit_percent')->nullable();
			$table->enum('available_to', ['owner_occupier', 'investor', 'first_home'])->default('owner_occupier');
			$table->string('market_region', 10)->default('AU');
			$table->json('feature_flags')->nullable();
			$table->timestamp('captured_at')->nullable();
			$table->string('source')->nullable();
			$table->timestamps();

			$table->index(['provider', 'rate_type']);
			$table->index(['market_region', 'available_to']);
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('mortgage_rate_snapshots');
	}
};
