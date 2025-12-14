<?php

use App\Models\AdvertisingAudienceSegment;
use App\Models\AdvertisingCampaign;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	/**
	 * Run the migrations.
	 */
	public function up(): void
	{
		Schema::create('advertising_campaign_audience', function (Blueprint $table) {
			$table->id();
			$table->foreignIdFor(AdvertisingCampaign::class, 'campaign_id')
				->constrained('advertising_campaigns')
				->cascadeOnDelete();
			$table->foreignIdFor(AdvertisingAudienceSegment::class, 'segment_id')
				->constrained('advertising_audience_segments')
				->cascadeOnDelete();
			$table->json('constraints')->nullable();
			$table->timestamps();

			$table->unique(['campaign_id', 'segment_id']);
		});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists('advertising_campaign_audience');
	}
};
