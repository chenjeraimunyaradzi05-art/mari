<?php

declare(strict_types=1);

namespace App\Observers\WomenRealEstate;

use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use App\Services\WomenRealEstate\Contracts\WomenListingAnalyticsServiceContract as WomenListingAnalyticsService;
use Illuminate\Validation\ValidationException;

final class WomenListingObserver
{


    public function created(WomenListing $listing): void
    {
        $this->invalidateMetricsCache();
    }

    public function updated(WomenListing $listing): void
    {
        $this->invalidateMetricsCache();
    }

    public function saving(WomenListing $listing): void
    {
        // Ensure a listing cannot be published if its assigned agent is not verified.
        if ($listing->published_at !== null && $listing->agent_id !== null) {
            $agent = $listing->agent()->first();

            if ($agent === null || $agent->verified_at === null) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'agent' => ['Agent must be verified before publishing.'],
                ]);
            }
        }
    }

    public function deleted(WomenListing $listing): void
    {
        $this->invalidateMetricsCache();
    }

    private function invalidateMetricsCache(): void
    {
        app(WomenListingAnalyticsService::class)->invalidateMetricsCache();
    }

}

