<?php

use App\Models\AdvertisingCampaign;
use App\Models\Company;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	/**
	 * Run the migrations.
	 */
	public function up(): void
	{
		Schema::create('advertising_campaigns', function (Blueprint $table) {
			$table->id();
			$table->foreignIdFor(Company::class)->constrained()->cascadeOnDelete();
			$table->string('name');
			$table->string('status')->default(AdvertisingCampaign::STATUS_DRAFT);
			$table->string('objective');
			$table->json('targeting')->nullable();
			$table->json('tracking_parameters')->nullable();
			$table->decimal('daily_budget', 12, 2)->nullable();
			$table->decimal('lifetime_budget', 12, 2)->nullable();
			$table->date('starts_at')->nullable();
			$table->date('ends_at')->nullable();
			$table->text('creative_brief')->nullable();
			$table->timestamps();
			$table->softDeletes();

			$table->index(['company_id', 'status']);
			$table->index(['company_id', 'objective']);
			$table->index(['company_id', 'starts_at']);
		});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists('advertising_campaigns');
	}
};
