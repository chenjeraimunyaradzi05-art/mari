<?php

namespace App\Jobs;

use App\Services\DreamJobMatcherService;
use Illuminate\Bus\Queueable;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class RunDreamJobMatcherJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue, Queueable, SerializesModels;

    public function __construct()
    {
        // reservation
    }

    public function handle(DreamJobMatcherService $matcher): void
    {
        $matcher->runForActiveAlerts();
    }
}
