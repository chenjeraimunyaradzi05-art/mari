<?php

namespace App\Console\Commands;

use App\Services\AIMetricsBroadcaster;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

final class BroadcastAIMetrics extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'ai:broadcast-metrics {--interval=5 : Broadcast interval in seconds}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Broadcast real-time AI metrics to WebSocket channels';

    /**
     * Execute the console command.
     */
    public function handle(AIMetricsBroadcaster $broadcaster): int
    {
        $interval = (int) $this->option('interval');

        $this->info("Starting AI metrics broadcaster (interval: {$interval}s)");
        $this->info('Press Ctrl+C to stop');

        // Infinite loop - command runs until manually stopped
        // @phpstan-ignore-next-line
        while (true) {
            try {
                $metrics = $broadcaster->broadcastMetrics();

                $this->line(sprintf(
                    '[%s] Broadcast: %d req/min | %dms avg | %.1f%% cache | %.1f%% error',
                    now()->format('H:i:s'),
                    $metrics['requests']['per_minute'] ?? 0,
                    $metrics['performance']['avg_response_time'] ?? 0,
                    $metrics['cache']['hit_rate'] ?? 0,
                    $metrics['errors']['rate'] ?? 0
                ));

            } catch (\Exception $e) {
                Log::error('Metrics broadcast failed: ' . $e->getMessage());
                $this->error('Broadcast failed: ' . $e->getMessage());
            }

            sleep($interval);
        }

        // @codeCoverageIgnore
        return Command::SUCCESS;
    }
}

