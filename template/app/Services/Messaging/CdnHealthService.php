<?php

namespace App\Services\Messaging;

use App\Models\CdnLatencySample;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Carbon;

class CdnHealthService
{
    /**
     * Cached configuration section used for calculations.
     * @var array<string, mixed>
     */
    private array $config;

    public function __construct(?array $config = null)
    {
        $this->config = $config ?? Config::get('messaging.cdn', []);
    }


    public function metrics(): array
    {
        $windowSeconds = $this->config['latency_window_seconds'];
        $degradedThreshold = $this->config['degraded_above_latency_ms'];
        $defaultRolling = $this->config['rolling_latency_ms'];
        $trendDelta = $this->config['latency_trend_delta_ms'] ?? 25;
        $sampleSize = $this->config['latency_sample_size'] ?? 12;
        $retentionMinutes = $this->config['latency_retention_minutes'] ?? 1440;
        $staleThresholdMinutes = $this->config['latency_stale_threshold_minutes'] ?? 15;
        $successRatioTarget = (float) ($this->config['latency_success_ratio_target'] ?? 0.9);
        $successRatioTarget = min(max($successRatioTarget, 0), 1);
        $failureStreakThreshold = (int) ($this->config['latency_failure_streak_threshold'] ?? 3);
        $percentiles = $this->resolvePercentiles();
        $histogramBuckets = $this->histogramBuckets();
        $histogramLabels = $this->histogramLabels($histogramBuckets);
        $latencyHistogram = $this->buildLatencyHistogram($windowSeconds, $histogramBuckets, $histogramLabels);

        $samples = $this->fetchSamples($windowSeconds, $sampleSize);
        $windowFailureCount = $this->windowFailureCount($windowSeconds);
        $totalProbeCount = $samples->count() + $windowFailureCount;
        $probeSuccessRatio = $totalProbeCount > 0
            ? $samples->count() / $totalProbeCount
            : 1.0;
        $probeSuccessRatio = round(min(max($probeSuccessRatio, 0), 1), 3);
        $rolling = $samples->avg('latency_ms') ?? $defaultRolling;
        $percentileStats = $this->calculatePercentiles($samples, $percentiles, $rolling);
        $trend = $this->determineTrend($samples, $trendDelta);
        $latestSuccessSample = $samples->first();
        $latestRecordedSample = $latestSuccessSample ?? $this->latestSuccessfulSample();
        $latestProbe = $this->latestProbe();
        $failureStreak = $this->failureStreak();
        $lastRecordedAt = $latestRecordedSample?->recorded_at ?? $latestProbe?->recorded_at;
        $isStale = $this->isStale($lastRecordedAt, $staleThresholdMinutes);
        $lastSampleAgeSeconds = $lastRecordedAt ? (int) $lastRecordedAt->diffInSeconds(Carbon::now()) : null;
        $hasProbeFailure = filled($latestProbe?->failure_reason);
        $degradedSignals = [];

        if ($rolling >= $degradedThreshold) {
            $degradedSignals[] = 'rolling_latency';
        }

        if ($isStale) {
            $degradedSignals[] = 'stale_samples';
        }

        if ($hasProbeFailure) {
            $degradedSignals[] = 'latest_probe_failed';
        }

        if ($totalProbeCount > 0 && $probeSuccessRatio < $successRatioTarget) {
            $degradedSignals[] = 'success_ratio';
        }

        if ($failureStreakThreshold > 0 && $failureStreak >= $failureStreakThreshold) {
            $degradedSignals[] = 'failure_streak';
        }

        $degradedSignals = array_values(array_unique($degradedSignals));
        $degraded = !empty($degradedSignals);

        return array_merge($this->config, [
            'rolling_latency_ms' => (int) round($rolling),
            'latency_trend' => $trend,
            'degraded' => $degraded,
            'window_sample_count' => $samples->count(),
            'window_failure_count' => $windowFailureCount,
            'probe_success_ratio' => $probeSuccessRatio,
            'last_sample_recorded_at' => $latestRecordedSample?->recorded_at?->toIso8601String(),
            'last_sample_latency_ms' => $latestRecordedSample?->latency_ms,
            'samples_retained_minutes' => $retentionMinutes,
            'latency_stale' => $isStale,
            'latency_stale_threshold_minutes' => $staleThresholdMinutes,
            'last_sample_age_seconds' => $lastSampleAgeSeconds,
            'last_probe_status_code' => $latestProbe?->status_code,
            'last_probe_attempts' => $latestProbe?->attempts,
            'last_probe_failure_reason' => $latestProbe?->failure_reason,
            'failure_streak' => $failureStreak,
            'latency_percentiles' => $percentileStats,
            'latency_histogram' => $latencyHistogram,
            'latency_histogram_labels' => array_values($histogramLabels),
            'latency_degraded_signals' => $degradedSignals,
            'latency_degraded_summary' => $this->summarizeDegradedSignals($degradedSignals),
        ]);
    }


    /**
     * @return int[]
     *
     * @psalm-return array<int, int>
     */
    private function calculatePercentiles(Collection $samples, array $percentiles, float $fallback): array
    {
        $latencies = $samples
            ->pluck('latency_ms')
            ->filter(fn ($latency) => $latency !== null)
            ->sort()
            ->values();

        if ($latencies->isEmpty()) {
            return collect($percentiles)
                ->mapWithKeys(fn ($percentile) => [(int) $percentile => (int) round($fallback)])
                ->all();
        }

        return collect($percentiles)
            ->mapWithKeys(function ($percentile) use ($latencies) {
                $percentile = (int) $percentile;
                $index = max(0, (int) ceil($percentile / 100 * $latencies->count()) - 1);

                return [$percentile => (int) $latencies->get($index)];
            })
            ->all();
    }

    /**
     * @return int[]
     *
     * @psalm-return array<int, int>
     */
    private function resolvePercentiles(): array
    {
        $values = collect($this->config['latency_percentiles'] ?? [50, 95])
            ->flatten()
            ->map(fn ($value) => (int) $value)
            ->filter(fn ($value) => $value > 0 && $value < 100)
            ->unique()
            ->sort()
            ->values();

        if ($values->isEmpty()) {
            return [50, 95];
        }

        return $values->all();
    }

    /**
     * @psalm-return \Illuminate\Database\Eloquent\Collection<int, CdnLatencySample>
     */
    private function fetchSamples(int $windowSeconds, int $sampleSize): \Illuminate\Database\Eloquent\Collection
    {
        return CdnLatencySample::query()
            ->where('recorded_at', '>=', Carbon::now()->subSeconds($windowSeconds))
            ->whereNotNull('latency_ms')
            ->orderByDesc('recorded_at')
            ->limit($sampleSize)
            ->get();
    }

    private function determineTrend(Collection $samples, int $deltaThreshold): string
    {
        if ($samples->count() < 2) {
            return $this->config['latency_trend'] ?? 'steady';
        }

        $latest = $samples->first()->latency_ms;
        $oldest = $samples->last()->latency_ms;
        $delta = $latest - $oldest;

        if ($delta >= $deltaThreshold) {
            return 'rising';
        }

        if ($delta <= -$deltaThreshold) {
            return 'falling';
        }

        return 'steady';
    }

    private function isStale(?Carbon $lastRecordedAt, int $thresholdMinutes): bool
    {
        if ($thresholdMinutes <= 0) {
            return false;
        }

        if (!$lastRecordedAt) {
            return true;
        }

        return $lastRecordedAt->lt(Carbon::now()->subMinutes($thresholdMinutes));
    }

    private function latestProbe(): CdnLatencySample|null
    {
        return CdnLatencySample::query()
            ->orderByDesc('recorded_at')
            ->first();
    }

    private function latestSuccessfulSample(): CdnLatencySample|null
    {
        return CdnLatencySample::query()
            ->whereNotNull('latency_ms')
            ->orderByDesc('recorded_at')
            ->first();
    }

    private function failureStreak(): int
    {
        $latestSuccess = CdnLatencySample::query()
            ->whereNotNull('latency_ms')
            ->orderByDesc('recorded_at')
            ->first();

        $query = CdnLatencySample::query()
            ->whereNull('latency_ms');

        if ($latestSuccess) {
            $query->where('recorded_at', '>', $latestSuccess->recorded_at);
        }

        return (int) $query->count();
    }

    private function windowFailureCount(int $windowSeconds): int
    {
        return CdnLatencySample::query()
            ->where('recorded_at', '>=', Carbon::now()->subSeconds($windowSeconds))
            ->whereNull('latency_ms')
            ->count();
    }

    /**
     * @return int[]
     *
     * @psalm-return array<int>
     */
    private function buildLatencyHistogram(int $windowSeconds, ?array $buckets = null, ?array $labels = null): array
    {
        $buckets ??= $this->histogramBuckets();
        $labels ??= $this->histogramLabels($buckets);
        $counts = [];

        foreach ($labels as $label) {
            $counts[$label] = 0;
        }

        $rawCounts = CdnLatencySample::query()
            ->selectRaw('percentile_bucket, COUNT(*) as aggregate')
            ->where('recorded_at', '>=', Carbon::now()->subSeconds($windowSeconds))
            ->whereNotNull('percentile_bucket')
            ->groupBy('percentile_bucket')
            ->pluck('aggregate', 'percentile_bucket');

        foreach ($rawCounts as $bucketIndex => $count) {
            $label = $labels[(int) $bucketIndex] ?? null;

            if ($label) {
                $counts[$label] = (int) $count;
            }
        }

        return $counts;
    }

    /**
     * @return int[]
     *
     * @psalm-return array<int, int>
     */
    private function histogramBuckets(): array
    {
        $configured = $this->config['latency_histogram_buckets_ms'] ?? [200, 400, 800];

        return collect($configured)
            ->map(fn ($value) => (int) $value)
            ->filter(fn ($value) => $value > 0)
            ->unique()
            ->sort()
            ->values()
            ->all() ?: [200, 400, 800];
    }

    /**
     * @return string[]
     *
     * @psalm-return array<float|int, string>
     */
    private function histogramLabels(array $buckets): array
    {
        $labels = [];

        foreach ($buckets as $index => $threshold) {
            $labels[$index + 1] = sprintf('<=%dms', $threshold);
        }

        $lastThreshold = end($buckets) ?: 0;
        $labels[count($buckets) + 1] = sprintf('>%dms', $lastThreshold);

        return $labels;
    }

    private function summarizeDegradedSignals(array $signals): string|null
    {
        if (empty($signals)) {
            return null;
        }

        $messages = array_map(fn (string $signal) => $this->formatDegradedSignal($signal), $signals);

        return implode(', ', $messages);
    }

    private function formatDegradedSignal(string $signal): string
    {
        return match ($signal) {
            'rolling_latency' => 'Rolling latency above threshold',
            'stale_samples' => 'Latency samples are stale',
            'latest_probe_failed' => 'Latest probe failed',
            'success_ratio' => 'Probe success ratio below target',
            'failure_streak' => 'Failure streak threshold exceeded',
            default => ucfirst(str_replace('_', ' ', $signal)),
        };
    }
}

