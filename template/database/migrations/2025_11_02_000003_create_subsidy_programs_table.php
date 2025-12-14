<?php

use App\Models\OrganizationPage;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	/**
	 * Run the migrations.
	 */
	public function up(): void
	{
		Schema::create('subsidy_programs', function (Blueprint $table) {
			$table->id();
			$table->foreignIdFor(OrganizationPage::class)
				->nullable()
				->constrained()
				->nullOnDelete();
			$table->string('name');
			$table->string('slug')->unique();
			$table->string('category')->nullable();
			$table->text('summary')->nullable();
			$table->text('eligibility')->nullable();
			$table->unsignedInteger('amount_cents')->nullable();
			$table->unsignedTinyInteger('coverage_percent')->nullable();
			$table->string('currency', 3)->default('USD');
			$table->date('starts_on')->nullable();
			$table->date('ends_on')->nullable();
			$table->string('status')->default('draft');
			$table->string('application_url')->nullable();
			$table->string('contact_email')->nullable();
			$table->json('meta')->nullable();
			$table->timestamps();
			$table->softDeletes();

			$table->index(['organization_page_id', 'status']);
			$table->index(['starts_on', 'ends_on']);
		});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists('subsidy_programs');
	}
};
