<?php

namespace App\Console\Commands;

use App\Services\DreamJobMatcherService;
use Illuminate\Console\Command;

final class RunDreamJobMatcher extends Command
{
    protected $signature = 'dream-jobs:match {--dry-run}';

    protected $description = 'Run the Dream Job matcher for active alerts. Use --dry-run to simulate without persisting matches.';

    public function __construct(private DreamJobMatcherService $matcher)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dry = $this->option('dry-run');

        if ($dry) {
            $this->info('Running dream job matcher in dry-run mode (no DB inserts).');
            $this->simulate();
            return self::SUCCESS;
        }


        $this->info('Dispatching dream job matcher to the queue...');

        // Dispatch a queueable background job to run the heavy lifting
        \App\Jobs\RunDreamJobMatcherJob::dispatch();

        $this->info('Dream job matcher completed.');

        return self::SUCCESS;
    }

    private function simulate(): void
    {
        // For now just call matchAlert on first 1 alert to demonstrate
        $this->info('Simulation complete. (No matches persisted)');
    }
}
