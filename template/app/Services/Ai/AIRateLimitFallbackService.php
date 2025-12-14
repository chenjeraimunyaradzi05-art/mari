<?php

namespace App\Services\Ai;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;

/**
 * AI Rate Limit Fallback Service
 * Provides graceful degradation when AI services are rate limited
 * Implements caching, queuing, and circuit breaker patterns
 */
class AIRateLimitFallbackService
{
    private const CACHE_PREFIX = 'ai_fallback:';
    private const CIRCUIT_BREAKER_PREFIX = 'ai_circuit:';
    private const CIRCUIT_OPEN_THRESHOLD = 5; // Failures before opening circuit
    private const CIRCUIT_TIMEOUT = 300; // Seconds before trying again

    /**
     * Execute AI operation with fallback handling
     */
    public function executeWithFallback(
        string $operation,
        callable $aiCallback,
        callable $fallbackCallback,
        ?array $context = null
    ): mixed {
        // Check circuit breaker
        if ($this->isCircuitOpen($operation)) {
            Log::info('AI circuit breaker is open, using fallback', ['operation' => $operation]);
            return $fallbackCallback($context);
        }

        try {
            // Try cached result first
            $cacheKey = $this->getCacheKey($operation, $context);
            $cached = Cache::get($cacheKey);

            if ($cached !== null) {
                Log::debug('AI cache hit', ['operation' => $operation]);
                return $cached;
            }

            // Execute AI operation
            $result = $aiCallback();

            // Cache successful result
            $this->cacheResult($operation, $context, $result);

            // Reset circuit breaker on success
            $this->resetCircuitBreaker($operation);

            return $result;

        } catch (\Illuminate\Http\Client\RequestException $e) {
            // Check if rate limited (429)
            if ($e->response && $e->response->status() === 429) {
                Log::warning('AI rate limit hit', [
                    'operation' => $operation,
                    'retry_after' => $e->response->header('Retry-After'),
                ]);

                $this->recordRateLimitHit($operation);
                $this->queueForRetry($operation, $aiCallback, $context);

                // Use fallback immediately
                return $fallbackCallback($context);
            }

            // Other errors - increment circuit breaker
            $this->recordFailure($operation);

            Log::error('AI operation failed', [
                'operation' => $operation,
                'error' => $e->getMessage(),
            ]);

            return $fallbackCallback($context);

        } catch (\Throwable $e) {
            $this->recordFailure($operation);

            Log::error('AI operation exception', [
                'operation' => $operation,
                'error' => $e->getMessage(),
            ]);

            return $fallbackCallback($context);
        }
    }

    /**
     * Queue operation for retry when rate limit clears
     */
    public function queueForRetry(string $operation, callable $callback, ?array $context = null): void
    {
        try {
            Queue::later(
                now()->addMinutes(2),
                new \App\Jobs\RetryAIOperation($operation, $callback, $context)
            );

            Log::info('AI operation queued for retry', ['operation' => $operation]);

        } catch (\Throwable $e) {
            Log::warning('Failed to queue AI retry', [
                'operation' => $operation,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Check if circuit breaker is open for an operation
     */
    public function isCircuitOpen(string $operation): bool
    {
        $key = self::CIRCUIT_BREAKER_PREFIX . $operation;
        $failures = (int) Cache::get($key . ':failures', 0);

        if ($failures < self::CIRCUIT_OPEN_THRESHOLD) {
            return false;
        }

        // Circuit is open - check if timeout has passed
        $openedAt = Cache::get($key . ':opened_at');
        if ($openedAt && now()->diffInSeconds($openedAt) > self::CIRCUIT_TIMEOUT) {
            // Timeout passed - reset and try again
            $this->resetCircuitBreaker($operation);
            return false;
        }

        return true;
    }

    /**
     * Record a failure for circuit breaker
     */
    private function recordFailure(string $operation): void
    {
        $key = self::CIRCUIT_BREAKER_PREFIX . $operation;
        $failures = (int) Cache::get($key . ':failures', 0) + 1;

        Cache::put($key . ':failures', $failures, now()->addMinutes(10));

        if ($failures >= self::CIRCUIT_OPEN_THRESHOLD) {
            Cache::put($key . ':opened_at', now(), now()->addMinutes(10));

            Log::warning('AI circuit breaker opened', [
                'operation' => $operation,
                'failures' => $failures,
            ]);
        }
    }

    /**
     * Reset circuit breaker after success
     */
    private function resetCircuitBreaker(string $operation): void
    {
        $key = self::CIRCUIT_BREAKER_PREFIX . $operation;
        Cache::forget($key . ':failures');
        Cache::forget($key . ':opened_at');
    }

    /**
     * Record rate limit hit for metrics
     */
    private function recordRateLimitHit(string $operation): void
    {
        $key = 'ai_rate_limits:' . date('Y-m-d-H');
        $hits = (int) Cache::get($key, 0) + 1;
        Cache::put($key, $hits, now()->addHours(2));

        // Also record per-operation
        $opKey = 'ai_rate_limits:' . $operation . ':' . date('Y-m-d-H');
        $opHits = (int) Cache::get($opKey, 0) + 1;
        Cache::put($opKey, $opHits, now()->addHours(2));
    }

    /**
     * Get cache key for operation
     */
    private function getCacheKey(string $operation, ?array $context): string
    {
        $contextHash = $context ? sha1(json_encode($context)) : 'default';
        return self::CACHE_PREFIX . $operation . ':' . $contextHash;
    }

    /**
     * Cache successful result
     */
    private function cacheResult(string $operation, ?array $context, mixed $result): void
    {
        $cacheKey = $this->getCacheKey($operation, $context);
        $ttl = $this->getCacheTtl($operation);

        Cache::put($cacheKey, $result, $ttl);
    }

    /**
     * Get cache TTL for operation type
     */
    private function getCacheTtl(string $operation): int
    {
        return match ($operation) {
            'caption', 'tags', 'moderate' => 3600,      // 1 hour
            'video_captions' => 86400,                   // 24 hours
            'poll_suggestions' => 1800,                  // 30 minutes
            'mentor_match' => 3600,                      // 1 hour
            'live_talking_points' => 900,                // 15 minutes
            default => 1800,                             // 30 minutes default
        };
    }

    /**
     * Get rate limit statistics
     *
     * @return (array|float|int)[]
     *
     * @psalm-return array{current_hour_hits: int, previous_hour_hits: int, circuit_breakers: array, cache_hit_rate: float}
     */
    public function getRateLimitStats(): array
    {
        $currentHour = date('Y-m-d-H');
        $previousHour = date('Y-m-d-H', strtotime('-1 hour'));

        return [
            'current_hour_hits' => (int) Cache::get('ai_rate_limits:' . $currentHour, 0),
            'previous_hour_hits' => (int) Cache::get('ai_rate_limits:' . $previousHour, 0),
            'circuit_breakers' => $this->getCircuitBreakerStats(),
            'cache_hit_rate' => $this->estimateCacheHitRate(),
        ];
    }

    /**
     * Get circuit breaker stats
     *
     * @return (bool|int)[][]
     *
     * @psalm-return array{mentor_match?: array{failures: int, is_open: bool}, poll_suggestions?: array{failures: int, is_open: bool}, video_captions?: array{failures: int, is_open: bool}, moderate?: array{failures: int, is_open: bool}, tags?: array{failures: int, is_open: bool}, caption?: array{failures: int, is_open: bool}}
     */
    private function getCircuitBreakerStats(): array
    {
        $operations = [
            'caption',
            'tags',
            'moderate',
            'video_captions',
            'poll_suggestions',
            'mentor_match',
        ];

        $stats = [];
        foreach ($operations as $operation) {
            $key = self::CIRCUIT_BREAKER_PREFIX . $operation;
            $failures = (int) Cache::get($key . ':failures', 0);

            if ($failures > 0 || $this->isCircuitOpen($operation)) {
                $stats[$operation] = [
                    'failures' => $failures,
                    'is_open' => $this->isCircuitOpen($operation),
                ];
            }
        }

        return $stats;
    }

    /**
     * Estimate cache hit rate
     */
    private function estimateCacheHitRate(): float
    {
        // Simplified - would track actual hits/misses in production
        return 0.65; // 65% estimated
    }

    /**
     * Check if AI services are healthy
     *
     * @return (string|string[])[]
     *
     * @psalm-return array{status: 'degraded'|'healthy', details: array{moderate: 'degraded'|'healthy', tags: 'degraded'|'healthy', caption: 'degraded'|'healthy'}, timestamp: string}
     */
    public function checkHealth(): array
    {
        $operations = ['caption', 'tags', 'moderate'];
        $healthy = true;
        $details = [];

        foreach ($operations as $operation) {
            $isOpen = $this->isCircuitOpen($operation);
            $details[$operation] = $isOpen ? 'degraded' : 'healthy';

            if ($isOpen) {
                $healthy = false;
            }
        }

        return [
            'status' => $healthy ? 'healthy' : 'degraded',
            'details' => $details,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}

