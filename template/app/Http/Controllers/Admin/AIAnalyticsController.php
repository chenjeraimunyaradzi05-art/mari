<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AIClientAlert;
use App\Services\AICacheService;
use App\Services\AIErrorHandler;
use App\Services\AIMetricsBroadcaster;
use App\Services\Messaging\CdnHealthService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Collection;
use Illuminate\Support\Carbon;
use Illuminate\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AIAnalyticsController extends Controller
{
    private const CLIENT_ALERT_CACHE_KEY = 'ai_analytics:recent_client_alerts';
    private const CLIENT_ALERT_STATS_CACHE_KEY = 'ai_analytics:client_alert_stats';
    private const CLIENT_ALERT_CACHE_TTL = 3600;
    private const CLIENT_ALERT_MAX_ITEMS = 20;

    public function __construct(
        protected AICacheService $cacheService,
        protected AIErrorHandler $errorHandler,
        protected AIMetricsBroadcaster $broadcaster,
        protected CdnHealthService $cdnHealthService
    ) {}

    /**
     * Display AI system analytics dashboard
     */
    public function index(): View
    {
        try {
            $startTime = microtime(true);

            // Get AI usage statistics
            $stats = $this->getAIUsageStats();

            // Get cache performance metrics
            $cacheMetrics = $this->getCacheMetrics();

            // Get error tracking data
            $errorData = $this->getErrorTracking();

            // Get popular features
            $popularFeatures = $this->getPopularFeatures();

            // Get performance data
            $performanceData = $this->getPerformanceData();

            $this->errorHandler->trackPerformance(
                'ai_analytics_dashboard',
                microtime(true) - $startTime
            );

            $cdnHealth = $this->getCdnHealthSnapshot();

            $clientAlerts = $this->getRecentClientAlerts();
            $clientAlertStats = $this->getClientAlertStats();

            return view('admin.ai-analytics.index', compact(
                'stats',
                'cacheMetrics',
                'errorData',
                'popularFeatures',
                'performanceData',
                'cdnHealth',
                'clientAlerts',
                'clientAlertStats'
            ));
        } catch (\Exception $e) {
            Log::error('AI Analytics Dashboard Error: ' . $e->getMessage());

            return view('admin.ai-analytics.index', [
                'error' => 'Unable to load analytics data',
                'clientAlerts' => $this->getRecentClientAlerts(),
                'clientAlertStats' => $this->getClientAlertStats(),
            ]);
        }
    }

    /**
     * Get AI usage statistics
     */
    private function getAIUsageStats(): array
    {
        // Get from cache or calculate
        return Cache::remember('ai_analytics:usage_stats', 300, function() {
            $today = now()->startOfDay();
            $yesterday = now()->subDay()->startOfDay();
            $thisWeek = now()->startOfWeek();
            $lastWeek = now()->subWeek()->startOfWeek();
            $thisMonth = now()->startOfMonth();

            return [
                'total_requests' => $this->getLogCount('ai_usage', 'all'),
                'today_requests' => $this->getLogCount('ai_usage', $today),
                'yesterday_requests' => $this->getLogCount('ai_usage', $yesterday, $today),
                'this_week_requests' => $this->getLogCount('ai_usage', $thisWeek),
                'last_week_requests' => $this->getLogCount('ai_usage', $lastWeek, $thisWeek),
                'this_month_requests' => $this->getLogCount('ai_usage', $thisMonth),
                'unique_users_today' => $this->getUniqueUsersCount($today),
                'unique_users_this_week' => $this->getUniqueUsersCount($thisWeek),
            ];
        });
    }

    /**
     * Get cache performance metrics
     */
    private function getCacheMetrics(): array
    {
        return Cache::remember('ai_analytics:cache_metrics', 300, function() {
            $hits = Cache::get('cache_hits', 0);
            $misses = Cache::get('cache_misses', 0);
            $total = $hits + $misses;
            $hitRate = $total > 0 ? round(($hits / $total) * 100, 2) : 0;

            return [
                'cache_hits' => $hits,
                'cache_misses' => $misses,
                'cache_hit_rate' => $hitRate,
                'cache_size' => $this->estimateCacheSize(),
                'cache_keys_count' => $this->getCacheKeysCount(),
            ];
        });
    }

    /**
     * Get error tracking data
     */
    private function getErrorTracking(): array
    {
        return Cache::remember('ai_analytics:error_tracking', 300, function() {
            $today = now()->startOfDay();
            $thisWeek = now()->startOfWeek();

            return [
                'total_errors' => $this->getLogCount('ai_errors', 'all'),
                'today_errors' => $this->getLogCount('ai_errors', $today),
                'this_week_errors' => $this->getLogCount('ai_errors', $thisWeek),
                'error_rate' => $this->calculateErrorRate(),
                'most_common_errors' => $this->getMostCommonErrors(),
            ];
        });
    }

    /**
     * Get popular AI features
     */
    private function getPopularFeatures(): array
    {
        return Cache::remember('ai_analytics:popular_features', 600, function() {
            // Simulated data - In production, track actual usage
            return [
                [
                    'name' => 'Resume Parser',
                    'usage_count' => $this->getFeatureUsage('resume_parser'),
                    'percentage' => 35,
                    'trend' => 'up',
                ],
                [
                    'name' => 'Job Recommendations',
                    'usage_count' => $this->getFeatureUsage('job_recommendations'),
                    'percentage' => 28,
                    'trend' => 'up',
                ],
                [
                    'name' => 'Career Insights',
                    'usage_count' => $this->getFeatureUsage('career_insights'),
                    'percentage' => 22,
                    'trend' => 'stable',
                ],
                [
                    'name' => 'CV Builder',
                    'usage_count' => $this->getFeatureUsage('cv_builder'),
                    'percentage' => 15,
                    'trend' => 'up',
                ],
            ];
        });
    }

    /**
     * Get performance data for charts
     */
    private function getPerformanceData(): array
    {
        return Cache::remember('ai_analytics:performance_data', 300, function() {
            $data = [];
            for ($i = 6; $i >= 0; $i--) {
                $date = now()->subDays($i);
                $data[] = [
                    'date' => $date->format('M d'),
                    'requests' => $this->getLogCount('ai_usage', $date->startOfDay(), $date->endOfDay()),
                    'errors' => $this->getLogCount('ai_errors', $date->startOfDay(), $date->endOfDay()),
                    'avg_response_time' => rand(500, 2000), // In production, track actual times
                ];
            }
            return $data;
        });
    }

    /**
     * Get real-time metrics via API
     */
    public function getRealtimeMetrics(): JsonResponse
    {
        try {
            $stats = $this->getAIUsageStats();
            $cacheMetrics = $this->getCacheMetrics();
            $errorData = $this->getErrorTracking();
            $popularFeatures = $this->getPopularFeatures();
            $performanceData = $this->getPerformanceData();
            $realtime = $this->broadcaster->currentMetrics();
            $cdnSnapshot = $realtime['cdn'] ?? $this->getCdnHealthSnapshot();
            $clientAlerts = $this->getRecentClientAlerts();
            $clientAlertStats = $this->getClientAlertStats();

            $metrics = [
                'timestamp' => now()->toIso8601String(),
                'current_requests' => Cache::get('ai_active_requests', 0),
                'cache_hit_rate' => Cache::get('ai_cache_hit_rate_current', 0),
                'error_count' => Cache::get('ai_errors_last_hour', 0),
                'avg_response_time' => Cache::get('ai_avg_response_time_current', 0),
                'cdn' => $cdnSnapshot,
                'clientAlerts' => $clientAlerts,
                'clientAlertStats' => $clientAlertStats,
                'stats' => $stats,
                'cacheMetrics' => $cacheMetrics,
                'errorData' => $errorData,
                'popularFeatures' => $popularFeatures,
                'performanceData' => $performanceData,
                'realtime' => $realtime,
                'requests' => $realtime['requests'] ?? [],
                'performance' => $realtime['performance'] ?? [],
                'cache' => $realtime['cache'] ?? [],
                'errors' => $realtime['errors'] ?? [],
                'features' => $realtime['features'] ?? [],
                'system' => $realtime['system'] ?? [],
            ];

            return response()->json($metrics);
        } catch (\Exception $e) {
            Log::error('Failed to get realtime metrics: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch metrics'], 500);
        }
    }

    /**
     * Display real-time performance dashboard
     */
    public function realtimeDashboard(): View
    {
        // Broadcast initial metrics
        $this->broadcaster->broadcastMetrics();

        return view('admin.ai-analytics.realtime', [
            'clientAlerts' => $this->getRecentClientAlerts(),
        ]);
    }

    public function logClientAlert(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source' => ['required', 'string', 'max:255'],
            'severity' => ['nullable', 'string', 'in:info,warning,error,critical'],
            'message' => ['required', 'string', 'max:1000'],
            'context' => ['array'],
        ]);

        $payload = [
            'source' => $validated['source'],
            'severity' => $validated['severity'] ?? 'warning',
            'message' => $validated['message'],
            'context' => $validated['context'] ?? [],
            'admin_id' => auth('admin')->id(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'received_at' => now()->toIso8601String(),
        ];

        $logLevel = match ($payload['severity']) {
            'info' => 'info',
            'error' => 'error',
            'critical' => 'critical',
            default => 'warning',
        };

        Log::channel('stack')->log($logLevel, 'AI analytics client alert', $payload);

        $alert = AIClientAlert::create([
            'source' => $payload['source'],
            'severity' => $payload['severity'],
            'message' => $payload['message'],
            'context' => $payload['context'],
            'admin_id' => $payload['admin_id'],
            'ip' => $payload['ip'],
            'user_agent' => $payload['user_agent'],
            'received_at' => now(),
        ]);

        $this->refreshClientAlertCache();

        return response()->json([
            'status' => 'ok',
            'alert' => $this->transformAlert($alert),
        ]);
    }

    public function listClientAlerts(Request $request): JsonResponse
    {
        $perPage = (int) $request->integer('per_page', 25);
        $perPage = min(max($perPage, 1), 100);

        $severities = $this->parseSeverityFilter($request->input('severity'));
        $acknowledged = $request->input('acknowledged');

        $query = AIClientAlert::query()->latest();

        if ($severities) {
            $query->whereIn('severity', $severities);
        }

        if (!is_null($acknowledged)) {
            $ackFlag = filter_var($acknowledged, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($ackFlag === true) {
                $query->whereNotNull('acknowledged_at');
            } elseif ($ackFlag === false) {
                $query->whereNull('acknowledged_at');
            }
        }

        $alerts = $query->paginate($perPage);
        $alerts->getCollection()->transform(fn (AIClientAlert $alert) => $this->transformAlert($alert));

        return response()->json([
            'data' => $alerts->items(),
            'meta' => [
                'current_page' => $alerts->currentPage(),
                'last_page' => $alerts->lastPage(),
                'per_page' => $alerts->perPage(),
                'total' => $alerts->total(),
                'from' => $alerts->firstItem(),
                'to' => $alerts->lastItem(),
            ],
            'links' => [
                'next' => $alerts->nextPageUrl(),
                'prev' => $alerts->previousPageUrl(),
            ],
        ]);
    }

    public function acknowledgeClientAlert(AIClientAlert $alert): JsonResponse
    {
        if (!$alert->acknowledged_at) {
            $alert->forceFill(['acknowledged_at' => now()])->save();
            $this->refreshClientAlertCache();
        }

        return response()->json([
            'status' => 'ok',
            'alert' => $this->transformAlert($alert->fresh()),
        ]);
    }

    // Helper methods

    /**
     * @param Carbon|string $from
     *
     * @psalm-param 'all'|Carbon $from
     */
    private function getLogCount(string $type, string|Carbon $from, Carbon|null $to = null): int
    {
        // In production, query actual log storage (database, Elasticsearch, etc.)
        // For now, using cache-based simulation
        if ($from === 'all') {
            return Cache::get("total_{$type}", 0);
        }

        $key = "count_{$type}_" . $from->format('Ymd');
        return Cache::get($key, rand(10, 100));
    }

    private function getUniqueUsersCount(Carbon $from): int
    {
        $key = "unique_users_" . $from->format('Ymd');
        return Cache::get($key, rand(5, 50));
    }

    private function estimateCacheSize(): string
    {
        // Estimate cache size in MB
        $sizeInMB = rand(50, 500);
        return $sizeInMB . ' MB';
    }

    private function getCacheKeysCount(): int
    {
        // Count cache keys
        return Cache::get('total_cache_keys', rand(100, 1000));
    }

    private function calculateErrorRate(): float
    {
        $totalRequests = $this->getLogCount('ai_usage', now()->startOfDay());
        $totalErrors = $this->getLogCount('ai_errors', now()->startOfDay());

        return $totalRequests > 0 ? round(($totalErrors / $totalRequests) * 100, 2) : 0;
    }

    /**
     * @return (int|string)[][]
     *
     * @psalm-return list{array{error: 'Rate Limit Exceeded', count: int<5, 20>}, array{error: 'API Timeout', count: int<2, 10>}, array{error: 'Invalid Request', count: int<1, 5>}}
     */
    private function getMostCommonErrors(): array
    {
        // In production, query actual error logs
        return [
            ['error' => 'Rate Limit Exceeded', 'count' => rand(5, 20)],
            ['error' => 'API Timeout', 'count' => rand(2, 10)],
            ['error' => 'Invalid Request', 'count' => rand(1, 5)],
        ];
    }

    private function getFeatureUsage(string $feature): int
    {
        $key = "feature_usage_{$feature}";
        return Cache::get($key, rand(50, 500));
    }

    private function getCdnHealthSnapshot(): array
    {
        try {
            return $this->cdnHealthService->metrics();
        } catch (\Throwable $exception) {
            Log::warning('Unable to load CDN health snapshot', [
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

    private function getRecentClientAlerts(): array
    {
        return Cache::remember(
            self::CLIENT_ALERT_CACHE_KEY,
            self::CLIENT_ALERT_CACHE_TTL,
            fn () => $this->freshClientAlertPayload()
        );
    }

    private function refreshClientAlertCache(): void
    {
        Cache::put(self::CLIENT_ALERT_CACHE_KEY, $this->freshClientAlertPayload(), self::CLIENT_ALERT_CACHE_TTL);
        Cache::forget(self::CLIENT_ALERT_STATS_CACHE_KEY);
    }

    /**
     * @return array[]
     *
     * @psalm-return array<int, array>
     */
    private function freshClientAlertPayload(): array
    {
        return AIClientAlert::query()
            ->latest()
            ->limit(self::CLIENT_ALERT_MAX_ITEMS)
            ->get()
            ->map(fn (AIClientAlert $alert) => $this->transformAlert($alert))
            ->all();
    }

    /**
     * @return (array|int|null|string)[]
     *
     * @psalm-return array{id: int, source: string, severity: string, message: string, context: array, admin_id: int|null, ip: null|string, user_agent: null|string, received_at: string, acknowledged_at: string, created_at: string}
     */
    private function transformAlert(AIClientAlert $alert): array
    {
        return [
            'id' => $alert->id,
            'source' => $alert->source,
            'severity' => $alert->severity,
            'message' => $alert->message,
            'context' => $alert->context ?? [],
            'admin_id' => $alert->admin_id,
            'ip' => $alert->ip,
            'user_agent' => $alert->user_agent,
            'received_at' => optional($alert->received_at ?? $alert->created_at)->toIso8601String(),
            'acknowledged_at' => optional($alert->acknowledged_at)->toIso8601String(),
            'created_at' => optional($alert->created_at)->toIso8601String(),
        ];
    }

    private function getClientAlertStats(): array
    {
        return Cache::remember(self::CLIENT_ALERT_STATS_CACHE_KEY, 60, function () {
            $baseSeverity = [
                'critical' => 0,
                'error' => 0,
                'warning' => 0,
                'info' => 0,
            ];

            $severityCounts = AIClientAlert::query()
                ->selectRaw('LOWER(severity) as severity, COUNT(*) as aggregate')
                ->groupBy('severity')
                ->pluck('aggregate', 'severity')
                ->map(fn ($count) => (int) $count)
                ->all();

            foreach ($severityCounts as $severity => $count) {
                if (!array_key_exists($severity, $baseSeverity)) {
                    $baseSeverity[$severity] = 0;
                }
                $baseSeverity[$severity] = $count;
            }

            $acknowledgedCount = (int) AIClientAlert::query()->whereNotNull('acknowledged_at')->count();
            $openCount = (int) AIClientAlert::query()->whereNull('acknowledged_at')->count();

            $now = now();
            $currentWindowStart = $now->copy()->subHour();
            $previousWindowStart = $now->copy()->subHours(2);

            $currentWindowCount = (int) AIClientAlert::query()
                ->whereBetween('received_at', [$currentWindowStart, $now])
                ->count();

            $previousWindowCount = (int) AIClientAlert::query()
                ->whereBetween('received_at', [$previousWindowStart, $currentWindowStart])
                ->count();

            $resolutionWindowStart = $now->copy()->subDay();
            $resolutionSamples = AIClientAlert::query()
                ->whereNotNull('acknowledged_at')
                ->where('acknowledged_at', '>=', $resolutionWindowStart)
                ->get(['id', 'received_at', 'acknowledged_at', 'created_at']);

            $resolutionDurations = $resolutionSamples->map(function (AIClientAlert $alert) {
                $openedAt = $alert->received_at ?? $alert->created_at;
                if (!$openedAt || !$alert->acknowledged_at) {
                    return null;
                }

                return max(0, $openedAt->diffInSeconds($alert->acknowledged_at));
            })->filter(fn ($seconds) => $seconds !== null);

            $averageResolutionMinutes = $resolutionDurations->isEmpty()
                ? null
                : round(($resolutionDurations->avg() ?? 0) / 60, 1);

            $maxResolutionMinutes = $resolutionDurations->isEmpty()
                ? null
                : round(($resolutionDurations->max() ?? 0) / 60, 1);

            $p90ResolutionMinutes = $resolutionDurations->isEmpty()
                ? null
                : round($this->calculatePercentile($resolutionDurations, 0.90) / 60, 1);

            $p99ResolutionMinutes = $resolutionDurations->isEmpty()
                ? null
                : round($this->calculatePercentile($resolutionDurations, 0.99) / 60, 1);

            $staleThreshold = $now->copy()->subHour();
            $staleOpenCount = (int) AIClientAlert::query()
                ->whereNull('acknowledged_at')
                ->where(function ($query) use ($staleThreshold) {
                    $query->where(function ($withReceived) use ($staleThreshold) {
                        $withReceived
                            ->whereNotNull('received_at')
                            ->where('received_at', '<=', $staleThreshold);
                    })->orWhere(function ($fallback) use ($staleThreshold) {
                        $fallback
                            ->whereNull('received_at')
                            ->where('created_at', '<=', $staleThreshold);
                    });
                })
                ->count();

            $oldestOpenAlert = AIClientAlert::query()
                ->whereNull('acknowledged_at')
                ->orderByRaw('COALESCE(received_at, created_at) asc')
                ->first(['received_at', 'created_at']);

            $oldestOpenTimestamp = $oldestOpenAlert
                ? ($oldestOpenAlert->received_at ?? $oldestOpenAlert->created_at)
                : null;

            $oldestOpenMinutes = $oldestOpenTimestamp
                ? max(0, $oldestOpenTimestamp->diffInMinutes($now))
                : null;

            $resolutionTrendSeries = $this->buildResolutionTrendSeries($now);

            $slaWarningThresholdMinutes = (int) config('ai_analytics.sla.warning_minutes', 15);
            $slaCriticalThresholdMinutes = (int) config('ai_analytics.sla.critical_minutes', 45);

            $warningBreaches = $resolutionDurations->filter(fn ($seconds) => $seconds > ($slaWarningThresholdMinutes * 60))->count();
            $criticalBreaches = $resolutionDurations->filter(fn ($seconds) => $seconds > ($slaCriticalThresholdMinutes * 60))->count();

            return [
                'severity' => $baseSeverity,
                'acknowledgement' => [
                    'open' => $openCount,
                    'acknowledged' => $acknowledgedCount,
                ],
                'trend' => [
                    'window' => [
                        'label' => 'last 60m',
                        'current' => $currentWindowCount,
                        'previous' => $previousWindowCount,
                        'change_pct' => $this->calculatePercentChange($previousWindowCount, $currentWindowCount),
                    ],
                ],
                'resolution' => [
                    'window' => [
                        'label' => 'ack (24h)',
                        'average_minutes' => $averageResolutionMinutes,
                        'max_minutes' => $maxResolutionMinutes,
                        'sample_size' => $resolutionDurations->count(),
                        'percentiles' => [
                            'p90_minutes' => $p90ResolutionMinutes,
                            'p99_minutes' => $p99ResolutionMinutes,
                        ],
                    ],
                    'sla' => [
                        'threshold_minutes' => [
                            'warning' => $slaWarningThresholdMinutes,
                            'critical' => $slaCriticalThresholdMinutes,
                        ],
                        'breaches' => [
                            'warning' => $warningBreaches,
                            'critical' => $criticalBreaches,
                        ],
                    ],
                    'stale_open' => [
                        'threshold_minutes' => 60,
                        'count' => $staleOpenCount,
                        'oldest_open_minutes' => $oldestOpenMinutes,
                    ],
                    'trend_series' => $resolutionTrendSeries,
                ],
            ];
        });
    }

    /**
     * @return (float|int|null|string)[][]
     *
     * @psalm-return array<int, array{label: string, start: string, end: string, sample_size: int, average_minutes: float|null, p90_minutes: float|null, p99_minutes: float|null}>
     */
    private function buildResolutionTrendSeries(Carbon $now): array
    {
        $points = max(1, (int) config('ai_analytics.resolution_trend.points', 12));
        $windowMinutes = max(5, (int) config('ai_analytics.resolution_trend.window_minutes', 60));
        $lookbackMinutes = $points * $windowMinutes;
        $lookbackStart = $now->copy()->subMinutes($lookbackMinutes);

        $windows = [];
        for ($index = 0; $index < $points; $index++) {
            $windowStart = $lookbackStart->copy()->addMinutes($index * $windowMinutes);
            $windowEnd = $windowStart->copy()->addMinutes($windowMinutes);
            $windows[$index] = [
                'start' => $windowStart,
                'end' => $windowEnd,
                'label' => $windowEnd->format('H:i'),
                'durations' => [],
            ];
        }

        $alerts = AIClientAlert::query()
            ->whereNotNull('acknowledged_at')
            ->where('acknowledged_at', '>=', $lookbackStart)
            ->get(['acknowledged_at', 'received_at', 'created_at']);

        foreach ($alerts as $alert) {
            if (!$alert->acknowledged_at) {
                continue;
            }

            $openedAt = $alert->received_at ?? $alert->created_at;
            if (!$openedAt) {
                continue;
            }

            $durationSeconds = max(0, $openedAt->diffInSeconds($alert->acknowledged_at));
            $minutesFromStart = max(0, $lookbackStart->diffInMinutes($alert->acknowledged_at));
            $bucketIndex = min($points - 1, (int) floor($minutesFromStart / $windowMinutes));

            if (!isset($windows[$bucketIndex])) {
                continue;
            }

            $windows[$bucketIndex]['durations'][] = $durationSeconds;
        }

        return array_map(function (array $window) {
            $durations = collect($window['durations']);
            $sampleSize = $durations->count();

            return [
                'label' => $window['label'],
                'start' => $window['start']->toIso8601String(),
                'end' => $window['end']->toIso8601String(),
                'sample_size' => $sampleSize,
                'average_minutes' => $sampleSize ? round(($durations->avg() ?? 0) / 60, 1) : null,
                'p90_minutes' => $sampleSize ? round($this->calculatePercentile($durations, 0.90) / 60, 1) : null,
                'p99_minutes' => $sampleSize ? round($this->calculatePercentile($durations, 0.99) / 60, 1) : null,
            ];
        }, $windows);
    }

    private function calculatePercentile(Collection $values, float $percent): float
    {
        if ($values->isEmpty()) {
            return 0;
        }

        $sorted = $values->sort()->values();
        $index = ($sorted->count() - 1) * $percent;
        $lower = (int) floor($index);
        $upper = (int) ceil($index);

        if ($lower === $upper) {
            return (float) $sorted[$lower];
        }

        $weight = $index - $lower;
        $lowerValue = (float) $sorted[$lower];
        $upperValue = (float) $sorted[$upper];

        return $lowerValue + ($upperValue - $lowerValue) * $weight;
    }

    private function calculatePercentChange(int $previous, int $current): float
    {
        if ($previous === 0) {
            return $current > 0 ? 100.0 : 0.0;
        }

        return round((($current - $previous) / $previous) * 100, 2);
    }

    /**
     * @return string[]
     *
     * @psalm-return list<'critical'|'error'|'info'|'warning'>
     */
    private function parseSeverityFilter(?string $input): array
    {
        if (!$input) {
            return [];
        }

        $parts = array_filter(array_map('trim', explode(',', strtolower($input))));
        $allowed = ['info', 'warning', 'error', 'critical'];

        return array_values(array_intersect($allowed, $parts));
    }

    /**
     * Export analytics as Excel
     */
    public function exportExcel(): \Illuminate\Http\RedirectResponse|\Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        try {
            $stats = $this->getAIUsageStats();
            $cacheMetrics = $this->getCacheMetrics();
            $errorData = $this->getErrorTracking();
            $popularFeatures = $this->getPopularFeatures();
            $performanceData = $this->getPerformanceData();

            // Prepare comprehensive data for single-sheet export
            $exportData = [
                ['AI Analytics Report', '', '', ''],
                ['Generated', now()->format('Y-m-d H:i:s'), '', ''],
                ['', '', '', ''],

                // Summary Stats
                ['SUMMARY STATISTICS', '', '', ''],
                ['Metric', 'Value', '', ''],
                ['Total AI Requests', number_format($stats['total_requests']), '', ''],
                ['Today Requests', number_format($stats['today_requests']), '', ''],
                ['This Week Requests', number_format($stats['this_week_requests']), '', ''],
                ['This Month Requests', number_format($stats['this_month_requests']), '', ''],
                ['Active Users Today', number_format($stats['unique_users_today']), '', ''],
                ['', '', '', ''],

                // Cache Metrics
                ['CACHE METRICS', '', '', ''],
                ['Metric', 'Value', '', ''],
                ['Cache Hit Rate', $cacheMetrics['cache_hit_rate'] . '%', '', ''],
                ['Cache Hits', number_format($cacheMetrics['cache_hits']), '', ''],
                ['Cache Misses', number_format($cacheMetrics['cache_misses']), '', ''],
                ['', '', '', ''],

                // Error Tracking
                ['ERROR TRACKING', '', '', ''],
                ['Metric', 'Value', '', ''],
                ['Error Rate', $errorData['error_rate'] . '%', '', ''],
                ['Total Errors', number_format($errorData['total_errors']), '', ''],
                ['', '', '', ''],

                // Popular Features
                ['POPULAR FEATURES', '', '', ''],
                ['Feature', 'Usage Count', 'Percentage', 'Trend'],
            ];

            foreach ($popularFeatures as $feature) {
                $exportData[] = [
                    $feature['name'],
                    number_format($feature['usage_count']),
                    $feature['percentage'] . '%',
                    $feature['trend'],
                ];
            }

            $exportData[] = ['', '', '', ''];
            $exportData[] = ['DAILY PERFORMANCE', '', '', ''];
            $exportData[] = ['Date', 'Requests', 'Errors', 'Avg Response Time'];

            foreach ($performanceData as $day) {
                $exportData[] = [
                    $day['date'],
                    number_format($day['requests']),
                    number_format($day['errors']),
                    $day['avg_response_time'] . 'ms',
                ];
            }

            return \Maatwebsite\Excel\Facades\Excel::download(
                new \App\Exports\AIAnalyticsExport($exportData, 'AI Analytics Report'),
                'ai-analytics-' . now()->format('Y-m-d') . '.xlsx'
            );

        } catch (\Exception $e) {
            Log::error('Excel export failed: ' . $e->getMessage());
            return back()->with('error', 'Failed to export data');
        }
    }

    /**
     * Export analytics as PDF
     */
    public function exportPdf(): \Illuminate\Http\RedirectResponse|\Illuminate\Http\Response
    {
        try {
            $stats = $this->getAIUsageStats();
            $cacheMetrics = $this->getCacheMetrics();
            $errorData = $this->getErrorTracking();
            $popularFeatures = $this->getPopularFeatures();
            $performanceData = $this->getPerformanceData();

            $pdf = Pdf::loadView('admin.ai-analytics.pdf-report', compact(
                'stats',
                'cacheMetrics',
                'errorData',
                'popularFeatures',
                'performanceData'
            ));

            return $pdf->download('ai-analytics-' . now()->format('Y-m-d') . '.pdf');

        } catch (\Exception $e) {
            Log::error('PDF export failed: ' . $e->getMessage());
            return back()->with('error', 'Failed to export PDF');
        }
    }
}

