<?php

namespace App\Services\Performance;

use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

final class CacheStrategyService
{
    /**
     * Remember a value in cache using the defined strategy.
     *
     * @param string $key The specific cache key (e.g., 'job_listings.page.1')
     * @param string $strategyKey The key in config/cache_strategy.php (e.g., 'job_listings')
     * @param Closure $callback
     * @return mixed
     */
    public function remember(string $key, string $strategyKey, Closure $callback)
    {
        $strategy = config("cache_strategy.{$strategyKey}");

        if (!$strategy) {
            // Fallback to no cache if strategy not defined
            return $callback();
        }

        // If cache driver doesn't support tags (like file or database), fallback to standard remember
        if (!Cache::supportsTags()) {
            return Cache::remember($key, $strategy['ttl'], $callback);
        }

        return Cache::tags($strategy['tags'])
            ->remember($key, $strategy['ttl'], $callback);
    }

    public function invalidate(string $tag): void
    {
        if (Cache::supportsTags()) {
            Cache::tags([$tag])->flush();
            Log::info("Cache invalidated", ['tag' => $tag]);
        } else {
            // If tags aren't supported, we can't easily invalidate by tag.
            // We might need to clear everything or rely on TTL.
            // For now, we log a warning.
            Log::warning("Cache invalidation by tag requested but not supported by driver", ['tag' => $tag]);
        }
    }

    public function warmup(): void
    {
        // Warm critical queries
        $this->warmJobListings();
        // Add other warmup methods here
    }

    private function warmJobListings(): void
    {
        // Example warmup logic
        // $this->remember('job_listings.featured', 'job_listings', function() {
        //     return Job::where('is_featured', true)->get();
        // });
    }
}

