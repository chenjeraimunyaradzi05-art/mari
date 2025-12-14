<?php

namespace App\Jobs;

use App\Models\Candidate;
use App\Services\JobMatchingService;
use App\Services\BatchProcessingService;
use App\Services\AICacheService;
use App\Services\AIErrorHandler;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

final class BatchJobMatchingJob implements ShouldQueue
{
    use Queueable;

    public $timeout = 600; // 10 minutes
    public $tries = 2;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public array $candidateIds,
        public string $batchId,
        public int $chunkIndex = 0,
        public array $options = []
    ) {}
}

