<?php

namespace App\Jobs;

use App\Models\Candidate;
use App\Services\ResumeParserService;
use App\Services\AIErrorHandler;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

final class ProcessResumeParsingJob implements ShouldQueue
{
    use Queueable;

    public $timeout = 300; // 5 minutes
    public $tries = 3;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $candidateId,
        public string $resumePath,
        public ?string $jobId = null
    ) {}
}

