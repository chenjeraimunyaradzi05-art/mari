<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	public function up(): void
	{
		Schema::create('ad_campaigns', function (Blueprint $table) {
			$table->id();
			$table->foreignId('org_page_id')->constrained('organization_pages')->cascadeOnDelete();
			$table->string('name')->nullable();
			$table->enum('objective', ['reach','traffic','leads','applications'])->index();
			$table->enum('billing_model', ['cpm','cpc','cpa'])->default('cpm')->index();
			$table->unsignedBigInteger('budget_cents');
			$table->unsignedBigInteger('spent_cents')->default(0);
			$table->date('start_on');
			$table->date('end_on')->nullable();
			$table->json('targeting')->nullable();
			$table->enum('status', ['draft','active','paused','completed'])->default('draft')->index();
			$table->json('optimisation')->nullable();
			$table->timestamps();
			$table->softDeletes();

			$table->index(['org_page_id', 'status']);
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('ad_campaigns');
	}
};
