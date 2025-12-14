<?php

declare(strict_types=1);

namespace App\Console\Commands\Messaging;

use App\Models\CdnLatencySample;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

final class PruneCdnLatencySamplesCommand extends Command
{
    protected $signature = 'messaging:cdn:prune-samples {--minutes= : Override retention window in minutes}';

    protected $description = 'Prune CDN latency samples older than the configured retention window.';

    private function resolveRetentionMinutes(): int
    {
        $override = $this->option('minutes');

        if ($override !== null) {
            return (int) $override;
        }

        return (int) config('messaging.cdn.latency_retention_minutes', 1440);
    }

    public function handle(): int
    {
        $minutes = $this->resolveRetentionMinutes();

        // 0 => retention disabled
        if ($minutes <= 0) {
            return 0;
        }

        $cutoff = now()->subMinutes($minutes);

        CdnLatencySample::query()
            ->where('recorded_at', '<', $cutoff)
            ->delete();

        return 0;
    }
}

