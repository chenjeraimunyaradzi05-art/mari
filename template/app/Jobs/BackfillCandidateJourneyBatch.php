<?php

namespace App\Jobs;

use App\Models\Candidate;
use App\Services\CandidateJourneyAnalyticsRecorder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class BackfillCandidateJourneyBatch implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public array $candidateIds, public bool $force = true)
    {
        // keep default queue
    }

    public function handle(CandidateJourneyAnalyticsRecorder $recorder): void
    {
        $candidates = Candidate::query()->whereIn('id', $this->candidateIds)->get();

        if ($candidates->isEmpty()) {
            return;
        }

        $recorder->captureBatch($candidates->all(), $this->force);
    }
}
