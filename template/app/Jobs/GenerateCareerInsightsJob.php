<?php

namespace App\Jobs;

use App\Models\Candidate;
use App\Services\CareerInsightsService;
use App\Services\AICacheService;
use App\Services\AIErrorHandler;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

final class GenerateCareerInsightsJob implements ShouldQueue
{
    use Queueable;

    public $timeout = 180; // 3 minutes
    public $tries = 2;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $candidateId
    ) {}
}

