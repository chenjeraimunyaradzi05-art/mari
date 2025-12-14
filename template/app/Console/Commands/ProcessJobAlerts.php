<?php

namespace App\Console\Commands;

use App\Services\JobAlertService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

final class ProcessJobAlerts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'alerts:process {--dry-run : Run without sending notifications}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process all active job alerts and send notifications';

    /**
     * Execute the console command.
     *
     * @psalm-return 0|1
     */
    public function handle(JobAlertService $alertService): int
    {
        $this->info('Processing job alerts...');

        $startTime = microtime(true);

        try {
            if ($this->option('dry-run')) {
                $this->warn('Running in DRY RUN mode - no notifications will be sent');
            }

            $results = $alertService->processAlerts();

            $duration = round(microtime(true) - $startTime, 2);

            $this->info("✅ Alert processing complete in {$duration}s");
            $this->table(
                ['Metric', 'Count'],
                [
                    ['Alerts Processed', $results['processed']],
                    ['Notifications Sent', $results['sent']],
                    ['Errors', $results['errors']],
                ]
            );

            Log::info('Job alerts processed', $results);

            return Command::SUCCESS;

        } catch (\Exception $e) {
            $this->error('Failed to process alerts: ' . $e->getMessage());
            Log::error('Alert processing failed: ' . $e->getMessage());

            return Command::FAILURE;
        }
    }
}

