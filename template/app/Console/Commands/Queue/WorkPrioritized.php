<?php

namespace App\Console\Commands\Queue;

use Illuminate\Console\Command;

final class WorkPrioritized extends Command
{
    protected $signature = 'queue:work-prioritized
        {connection? : The queue connection to use}
        {--queue= : Override the prioritized queue order}
        {--once : Process only the next job on the queue}
        {--stop-when-empty : Stop when the queue is empty}
        {--delay=0 : The number of seconds to delay failed jobs}
        {--backoff=0 : The number of seconds to wait before retrying a job}
        {--memory=128 : The memory limit in megabytes}
        {--timeout=60 : The number of seconds a child process can run}
        {--sleep=3 : Seconds to sleep when no job is available}
        {--tries=1 : Number of times to attempt a job before logging it failed}
        {--max-jobs=0 : The number of jobs to process before stopping}
        {--max-time=0 : The number of seconds to run before stopping}
        {--force : Run even in maintenance mode}
        {--rest=0 : The number of seconds to rest between jobs}';

    protected $description = 'Run the queue worker with the configured prioritized queue order.';

    private function applyNumericOption(array &$parameters, string $option): void
    {
        $value = $this->option($option);

        if ($value === null) {
            return;
        }

        $parameters['--'.$option] = $value;
    }

    private function applyFlagOption(array &$parameters, string $option): void
    {
        if (! $this->option($option)) {
            return;
        }

        $parameters['--'.$option] = true;
    }
}

