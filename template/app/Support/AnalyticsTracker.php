<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

final class AnalyticsTracker
{
    public static function track(string $event, array $data = []): void
    {
        // Example: Send to external analytics service or log locally
    Log::info('Analytics Event', ['event' => $event, 'data' => $data]);
        // TODO: Integrate with real analytics provider (e.g., Mixpanel, Google Analytics, custom DB)
    }
}

