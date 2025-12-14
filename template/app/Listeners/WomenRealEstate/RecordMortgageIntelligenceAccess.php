<?php

declare(strict_types=1);

namespace App\Listeners\WomenRealEstate;

use App\Events\WomenRealEstate\MortgageIntelligenceAccessed;
use App\Models\MortgageIntelligenceAccessLog;
use App\Services\WomenRealEstate\MortgageTelemetryNotifier;
use Illuminate\Support\Facades\Log;

final class RecordMortgageIntelligenceAccess
{

	public function handle(MortgageIntelligenceAccessed $event): void
	{
		MortgageIntelligenceAccessLog::create([
			'user_id' => $event->user?->getKey(),
			'women_housing_listing_id' => $event->listing->getKey(),
			'channel' => $event->channel,
			'meta' => $event->meta ?: null,
			'accessed_at' => now(),
		]);

		// Also allow downstream systems to react (alerts/notifications) via notifier
		try {
			app(MortgageTelemetryNotifier::class)->capture($event);
		} catch (\Throwable $e) {
			// Do not break the request if notifier fails; log quietly
            
		}
	}

}

