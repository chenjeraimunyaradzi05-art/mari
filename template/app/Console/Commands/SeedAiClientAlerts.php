<?php

namespace App\Console\Commands;

use App\Models\AIClientAlert;
use Illuminate\Console\Command;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

final class SeedAiClientAlerts extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'ai-analytics:seed-alerts
        {--count=40 : Number of alerts to create}
        {--days=3 : Spread alerts across the last N days}
        {--ack-rate=35 : Percent of alerts that should be acknowledged}
        {--purge : Remove previously seeded alerts before inserting new ones}
        {--force : Skip confirmation prompts when running outside local/testing environments}';

    /**
     * The console command description.
     */
    protected $description = 'Populate the AI analytics dashboard with representative client alert history.';

    /**
     * @return (\Closure|string)[][]
     *
     * @psalm-return list{array{source: 'ai.analytics.metrics', severity: 'warning', message: 'Metrics refresh took longer than expected.', context: \Closure():array{latency_ms: int<1500, 5000>}}, array{source: 'ai.cache.monitor', severity: 'info', message: 'Cache hit rate recovered to safe levels.', context: \Closure():array{hit_rate: int<80, 95>}}, array{source: 'ai.errors.tracker', severity: 'error', message: 'Spike detected in inference errors.', context: \Closure():array{error_rate: int<6, 18>}}, array{source: 'messaging.cdn.guardrail', severity: 'critical', message: 'Messaging CDN latency above guardrail for 5 minutes.', context: \Closure():array{latency_ms: int<2500, 6000>}}, array{source: 'ai.user-feedback', severity: 'warning', message: 'Multiple users reported stale recommendations.', context: \Closure():array{reports: int<3, 12>}}, array{source: 'ai.realtime.guardian', severity: 'info', message: 'Realtime snapshot healthy across shards.', context: \Closure():array{shards: int<3, 6>}}}
     */
    private function scenarioLibrary(): array
    {
        return [
            [
                'source' => 'ai.analytics.metrics',
                'severity' => 'warning',
                'message' => 'Metrics refresh took longer than expected.',
                'context' => fn () => ['latency_ms' => random_int(1500, 5000)],
            ],
            [
                'source' => 'ai.cache.monitor',
                'severity' => 'info',
                'message' => 'Cache hit rate recovered to safe levels.',
                'context' => fn () => ['hit_rate' => random_int(80, 95)],
            ],
            [
                'source' => 'ai.errors.tracker',
                'severity' => 'error',
                'message' => 'Spike detected in inference errors.',
                'context' => fn () => ['error_rate' => random_int(6, 18)],
            ],
            [
                'source' => 'messaging.cdn.guardrail',
                'severity' => 'critical',
                'message' => 'Messaging CDN latency above guardrail for 5 minutes.',
                'context' => fn () => ['latency_ms' => random_int(2500, 6000)],
            ],
            [
                'source' => 'ai.user-feedback',
                'severity' => 'warning',
                'message' => 'Multiple users reported stale recommendations.',
                'context' => fn () => ['reports' => random_int(3, 12)],
            ],
            [
                'source' => 'ai.realtime.guardian',
                'severity' => 'info',
                'message' => 'Realtime snapshot healthy across shards.',
                'context' => fn () => ['shards' => random_int(3, 6)],
            ],
        ];
    }

    /**
     * @return string[]
     *
     * @psalm-return list{'10.10.0.5', '10.11.3.42', '10.12.9.77', '10.15.22.4', '10.20.1.16'}
     */
    private function sampleIps(): array
    {
        return [
            '10.10.0.5',
            '10.11.3.42',
            '10.12.9.77',
            '10.15.22.4',
            '10.20.1.16',
        ];
    }
}

