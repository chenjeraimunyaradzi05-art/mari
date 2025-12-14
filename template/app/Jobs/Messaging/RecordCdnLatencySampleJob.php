<?php

declare(strict_types=1);

namespace App\Jobs\Messaging;

use App\Models\CdnLatencySample;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

final class RecordCdnLatencySampleJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 1;

    public function __construct(private readonly ?string $probeUrl = null)
    {
        $this->queue = 'messaging';
    }

    public function handle(): void
    {
        $url = $this->probeUrl ?? config('messaging.cdn.latency_probe_url');

        if (!$url) {
            Log::warning('messaging.cdn.latency_probe_url_missing');

            return;
        }

        $timeout = (float) config('messaging.cdn.latency_probe_timeout', 2.5);
        $connectTimeout = (float) config('messaging.cdn.latency_probe_connect_timeout', $timeout);
        $method = strtoupper((string) config('messaging.cdn.latency_probe_method', 'HEAD'));

        $retries = (int) config('messaging.cdn.latency_probe_retries', 1);
        $maxAttempts = max(1, $retries + 1);
        $client = Http::timeout($timeout)
            ->connectTimeout($connectTimeout)
            ->retry($retries, 150);

        $started = microtime(true);


        try {
            $response = $method === 'GET'
                ? $client->get($url)
                : $client->head($url);
            $status = $response->status();
        } catch (Throwable $exception) {
            Log::warning('messaging.cdn.latency_probe_failed', [
                'url' => $url,
                'exception' => $exception->getMessage(),
            ]);

            $this->storeFailureSample($exception->getMessage(), $maxAttempts);

            return;
        }

        if (!$response->successful()) {
            Log::warning('messaging.cdn.latency_probe_unhealthy', [
                'url' => $url,
                'status' => $response->status(),
            ]);

            $this->storeFailureSample('http_'.$response->status(), $maxAttempts, $response->status());

            return;
        }

        $latencyMs = max(0, (int) round((microtime(true) - $started) * 1000));
        $bucket = $this->determinePercentileBucket($latencyMs);

        CdnLatencySample::query()->create([
            'latency_ms' => $latencyMs,
            'recorded_at' => now(),
            'status_code' => $status,
            'attempts' => $maxAttempts,
            'failure_reason' => null,
            'percentile_bucket' => $bucket,
        ]);
    }

    private function storeFailureSample(string $reason, int $attempts, ?int $statusCode = null): void
    {
        CdnLatencySample::query()->create([
            'latency_ms' => null,
            'recorded_at' => now(),
            'status_code' => $statusCode,
            'attempts' => $attempts,
            'failure_reason' => $reason,
            'percentile_bucket' => null,
        ]);
    }

    private function determinePercentileBucket(int $latencyMs): int|float
    {
        $buckets = $this->resolveHistogramBuckets();

        foreach ($buckets as $index => $threshold) {
            if ($latencyMs <= $threshold) {
                return $index + 1;
            }
        }

        return count($buckets) + 1;
    }

    /**
     * @return int[]
     *
     * @psalm-return array<int, int>
     */
    private function resolveHistogramBuckets(): array
    {
        $configured = config('messaging.cdn.latency_histogram_buckets_ms', []);
        $values = collect($configured)
            ->map(static fn ($value) => (int) $value)
            ->filter(static fn ($value) => $value > 0)
            ->unique()
            ->sort()
            ->values()
            ->all();

        return $values ?: [200, 400, 800];
    }
}

