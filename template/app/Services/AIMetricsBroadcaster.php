<?php

namespace App\Services;

use App\Models\Job;
use App\Models\Candidate;
use App\Models\Company;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Real-time metrics broadcasting service for AI Analytics Dashboard
 * Publishes live performance data via WebSockets
 */
class AIMetricsBroadcaster
{
    /**
     * Broadcast current AI system metrics
     */
    public function broadcastMetrics(): array
    {
        try {
            $metrics = $this->currentMetrics();

            // Broadcast via Pusher/WebSockets
            broadcast(new \App\Events\AIMetricsUpdated($metrics));

            return $metrics;
        } catch (\Exception $e) {
            Log::error('Failed to broadcast metrics: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Collect real-time metrics
     *
     * @return (array|string)[]
     *
     * @psalm-return array{timestamp: string, requests: array, performance: array, cache: array, errors: array, features: array, system: array, cdn: array}
     */
    public function currentMetrics(): array
    {
        return [
            'timestamp' => now()->toIso8601String(),
            'requests' => $this->getCurrentRequestMetrics(),
            'performance' => $this->getPerformanceMetrics(),
            'cache' => $this->getCacheMetrics(),
            'errors' => $this->getErrorMetrics(),
            'features' => $this->getFeatureMetrics(),
            'system' => $this->getSystemMetrics(),
            'cdn' => $this->getCdnHealthSnapshot(),
        ];
    }

    /**
     * Get current request metrics
     *
     * @psalm-return array{per_minute: mixed, today: mixed, active_users: mixed, concurrent_requests: mixed}
     */
    private function getCurrentRequestMetrics(): array
    {
        $currentMinute = now()->format('Y-m-d H:i');

        return [
            'per_minute' => Cache::get("ai_requests_minute_{$currentMinute}", 0),
            'today' => Cache::get('ai_requests_today', 0),
            'active_users' => Cache::get('ai_active_users_' . now()->format('Y-m-d'), 0),
            'concurrent_requests' => Cache::get('ai_concurrent_requests', 0),
        ];
    }

    /**
     * Get performance metrics
     *
     * @return (float|int|mixed)[]
     *
     * @psalm-return array{avg_response_time: 0|float, min_response_time: 0|mixed, max_response_time: 0|mixed, p95_response_time: float, p99_response_time: float}
     */
    private function getPerformanceMetrics(): array
    {
        $recentResponses = Cache::get('ai_recent_response_times', []);

        return [
            'avg_response_time' => !empty($recentResponses) ? round(array_sum($recentResponses) / count($recentResponses), 2) : 0,
            'min_response_time' => !empty($recentResponses) ? min($recentResponses) : 0,
            'max_response_time' => !empty($recentResponses) ? max($recentResponses) : 0,
            'p95_response_time' => $this->calculatePercentile($recentResponses, 95),
            'p99_response_time' => $this->calculatePercentile($recentResponses, 99),
        ];
    }

    /**
     * Get cache metrics
     *
     * @return (float|int|mixed|string)[]
     *
     * @psalm-return array{hit_rate: 0|float, hits: mixed, misses: mixed, size: string}
     */
    private function getCacheMetrics(): array
    {
        $hits = Cache::get('ai_cache_hits_today', 0);
        $misses = Cache::get('ai_cache_misses_today', 0);
        $total = $hits + $misses;

        return [
            'hit_rate' => $total > 0 ? round(($hits / $total) * 100, 2) : 0,
            'hits' => $hits,
            'misses' => $misses,
            'size' => $this->estimateCacheSize(),
        ];
    }

    /**
     * Get error metrics
     *
     * @return (array|float|int)[]
     *
     * @psalm-return array{count: int<0, max>, rate: 0|float, recent_errors: array, critical_errors: int}
     */
    private function getErrorMetrics(): array
    {
        $errors = Cache::get('ai_errors_today', []);
        $requests = Cache::get('ai_requests_today', 0);
        $errorCount = is_array($errors) ? count($errors) : 0;

        return [
            'count' => $errorCount,
            'rate' => $requests > 0 ? round(($errorCount / $requests) * 100, 2) : 0,
            'recent_errors' => is_array($errors) ? array_slice($errors, -5) : [],
            'critical_errors' => $this->getCriticalErrorCount(),
        ];
    }

    /**
     * Get feature usage metrics
     *
     * @psalm-return array{cv_builder: mixed, smart_posting: mixed, career_insights: mixed, job_matching: mixed, resume_parser: mixed}
     */
    private function getFeatureMetrics(): array
    {
        $features = ['resume_parser', 'job_matching', 'career_insights', 'smart_posting', 'cv_builder'];
        $usage = [];

        foreach ($features as $feature) {
            $count = Cache::get("feature_usage_{$feature}_today", 0);
            $usage[$feature] = $count;
        }

        return $usage;
    }

    /**
     * Get system health metrics
     *
     * @return (float|int|null|string)[]
     *
     * @psalm-return array{memory_usage: float, cpu_load: float|null, queue_size: int, database_connections: int, status: string}
     */
    private function getSystemMetrics(): array
    {
        return [
            'memory_usage' => round(memory_get_usage(true) / 1024 / 1024, 2), // MB
            'cpu_load' => $this->getCpuLoad(),
            'queue_size' => $this->getQueueSize(),
            'database_connections' => $this->getDatabaseConnections(),
            'status' => $this->getSystemStatus(),
        ];
    }

    /**
     * Calculate percentile for response times
     */
    private function calculatePercentile(array $values, int $percentile): float
    {
        if (empty($values)) {
            return 0;
        }

        sort($values);
        $index = ceil(($percentile / 100) * count($values)) - 1;
        return round($values[max(0, $index)] ?? 0, 2);
    }

    /**
     * Estimate cache size
     */
    private function estimateCacheSize(): string
    {
        // Simplified estimation based on key patterns
        $keys = ['ai_cache_*', 'job_match_*', 'resume_parse_*', 'career_insights_*'];
        $estimatedKeys = 0;

        foreach ($keys as $pattern) {
            $estimatedKeys += Cache::get("cache_keys_count_{$pattern}", 0);
        }

        $estimatedSize = $estimatedKeys * 5; // Assume 5KB per entry

        if ($estimatedSize > 1024) {
            return round($estimatedSize / 1024, 2) . ' MB';
        }

        return $estimatedSize . ' KB';
    }

    /**
     * Get critical error count
     */
    private function getCriticalErrorCount(): int
    {
        return Cache::get('ai_critical_errors_today', 0);
    }

    /**
     * Get CPU load (Linux/Unix only)
     */
    private function getCpuLoad(): ?float
    {
        if (function_exists('sys_getloadavg')) {
            $load = sys_getloadavg();
            return round($load[0] ?? 0, 2);
        }

        return null;
    }

    /**
     * Get queue size
     */
    private function getQueueSize(): int
    {
        try {
            return DB::table('jobs')->count();
        } catch (\Exception $e) {
            return 0;
        }
    }

    /**
     * Get active database connections
     *
     * @psalm-return int<0, max>
     */
    private function getDatabaseConnections(): int
    {
        try {
            $result = DB::select('SHOW PROCESSLIST');
            return count($result);
        } catch (\Exception $e) {
            return 0;
        }
    }

    /**
     * Determine overall system status
     *
     * @psalm-return 'critical'|'healthy'|'warning'
     */
    private function getSystemStatus(): string
    {
        $errorRate = Cache::get('ai_error_rate_today', 0);
        $responseTime = Cache::get('ai_avg_response_time_today', 0);

        if ($errorRate > 10 || $responseTime > 5000) {
            return 'critical';
        }

        if ($errorRate > 5 || $responseTime > 3000) {
            return 'warning';
        }

        return 'healthy';
    }

    private function getCdnHealthSnapshot(): array
    {
        try {
            return app(\App\Services\Messaging\CdnHealthService::class)->metrics();
        } catch (\Throwable $exception) {
            Log::warning('Unable to collect CDN health metrics', [
                'exception' => $exception->getMessage(),
            ]);

            return [
                'status' => 'unknown',
                'degraded' => false,
                'latency_degraded_signals' => [],
                'latency_degraded_summary' => null,
            ];
        }
    }
}

