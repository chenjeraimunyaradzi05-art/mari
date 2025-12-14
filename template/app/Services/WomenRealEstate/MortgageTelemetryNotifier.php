<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Events\WomenRealEstate\MortgageIntelligenceAccessed;
use App\Models\MortgageIntelligenceAccessLog;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

final class MortgageTelemetryNotifier
{
    private const WINDOW_MINUTES = 10;
    private const THRESHOLD_PER_LISTING = 25;
    private const THRESHOLD_TOTAL = 100;

    public function capture(MortgageIntelligenceAccessed $event): void
    {
        $since = Carbon::now()->subMinutes(self::WINDOW_MINUTES);

        $listingId = $event->listing->getKey();

        $recentCount = MortgageIntelligenceAccessLog::query()
            ->where('women_housing_listing_id', $listingId)
            ->where('accessed_at', '>=', $since)
            ->count();

        if ($recentCount >= self::THRESHOLD_PER_LISTING && $this->shouldAnnounce("listing:{$listingId}")) {
            $this->logMessage(
                sprintf(
                    'Listing %d had %d mortgage widget refreshes within %d minutes.',
                    $listingId,
                    $recentCount,
                    self::WINDOW_MINUTES
                )
            );
        }

        $totalRecent = MortgageIntelligenceAccessLog::query()
            ->where('accessed_at', '>=', $since)
            ->count();

        if ($totalRecent >= self::THRESHOLD_TOTAL && $this->shouldAnnounce('platform-total')) {
            $this->logMessage(
                sprintf(
                    'Mortgage widget recorded %d refreshes platform-wide within %d minutes.',
                    $totalRecent,
                    self::WINDOW_MINUTES
                )
            );
        }
    }

    private function shouldAnnounce(string $key): bool
    {
        $cacheKey = sprintf('mortgage-telemetry:%s', $key);

        return Cache::add($cacheKey, true, self::WINDOW_MINUTES * 60);
    }

    private function logMessage(string $message): void
    {
        Log::channel('daily')->info('[MortgageTelemetry] '.$message);
    }
}

