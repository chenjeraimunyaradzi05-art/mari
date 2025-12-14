<?php

declare(strict_types=1);

namespace App\Console\Commands\WomenRealEstate;

use App\Services\WomenRealEstate\Contracts\WomenListingAnalyticsServiceContract as WomenListingAnalyticsService;
use Illuminate\Console\Command;

final class ClearListingMetricsCache extends Command
{
    /**
     * The console command name and signature.
     *
     * @var string
     */
    protected $signature = 'women:listings:metrics-clear';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Flush the cached women real estate listing metrics.';

    public function handle(): int
    {
        // Resolve the analytics service and invalidate the metrics cache
        app(WomenListingAnalyticsService::class)->invalidateMetricsCache();

        $this->info('Women listing metrics cache cleared.');

        return 0;
    }
}

