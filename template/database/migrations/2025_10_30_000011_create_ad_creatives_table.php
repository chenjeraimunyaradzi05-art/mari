<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	public function up(): void
	{
		Schema::create('ad_creatives', function (Blueprint $table) {
			$table->id();
			$table->foreignId('campaign_id')->constrained('ad_campaigns')->cascadeOnDelete();
			$table->foreignId('media_id')->nullable()->constrained('org_media_assets')->nullOnDelete();
			$table->string('format')->nullable();
			$table->string('caption', 500)->nullable();
			$table->string('cta', 80)->nullable();
			$table->string('deeplink')->nullable();
			$table->json('meta')->nullable();
			$table->enum('status', ['draft','live','paused'])->default('draft')->index();
			$table->timestamps();

			$table->index(['campaign_id', 'status']);
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('ad_creatives');
	}
};
