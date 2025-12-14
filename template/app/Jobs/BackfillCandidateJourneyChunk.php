<?php

namespace App\Jobs;

use App\Services\CandidateJourneyAnalyticsRecorder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class BackfillCandidateJourneyChunk implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** @var array<int> */
    public array $candidateIds;

    public function __construct(array $candidateIds, public bool $force = true)
    {
        $this->candidateIds = $candidateIds;
    }

    public function handle(CandidateJourneyAnalyticsRecorder $recorder): void
    {
        if (empty($this->candidateIds)) {
            return;
        }

        $recorder->captureBatch($this->candidateIds, $this->force);
    }
}
