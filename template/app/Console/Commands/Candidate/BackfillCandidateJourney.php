<?php

namespace App\Console\Commands\Candidate;

use App\Jobs\BackfillCandidateJourneyChunk;
use App\Models\Candidate;
use App\Services\CandidateJourneyAnalyticsRecorder;
use Illuminate\Support\Facades\Log;
use Illuminate\Console\Command;

final class BackfillCandidateJourney extends Command
{
    // intentionally no extra traits — keep command minimal and test-friendly

    protected $signature = 'candidate:journey:backfill {--candidate=* : Candidate IDs to backfill} {--dry-run : Dry run (do not persist)} {--chunk-size=100 : Number of candidates to process per chunk} {--enqueue : Enqueue batch jobs instead of processing synchronously}';

    protected $description = 'Backfill candidate journey analytics for candidates.';

    public function handle(CandidateJourneyAnalyticsRecorder $recorder): int
    {
        $candidateIds = $this->option('candidate') ?: [];
        $dryRun = (bool) $this->option('dry-run');

        $enqueue = (bool) $this->option('enqueue');

        if (! empty($candidateIds)) {
            $candidates = Candidate::query()->whereIn('id', $candidateIds)->get();

            if ($dryRun) {
                $this->info('Dry-run: specific candidates skipped.');
                return 0;
            }

            if ($enqueue) {
                // dispatch a single job for the provided candidate ids
                BackfillCandidateJourneyChunk::dispatch($candidateIds, true);
                $this->info('Enqueued backfill job for specific candidate ids: ' . implode(',', $candidateIds));
                return 0;
            }
        } else {
            // iterate through all candidates via chunking
            $chunkSize = (int) $this->option('chunk-size') ?: 100;

            $processed = 0;
            $enqueue = (bool) $this->option('enqueue');

            $totalCandidates = (int) Candidate::query()->count();
            $totalChunks = (int) ceil(max(1, $totalCandidates) / $chunkSize);
            $chunkIndex = 0;

            Candidate::query()->chunk($chunkSize, function ($chunk) use ($recorder, $dryRun, $enqueue, &$processed, &$chunkIndex, $totalChunks, $chunkSize) {
                $chunkIndex++;

                $ids = $chunk->pluck('id')->all();

                $this->info("[chunk {$chunkIndex}/{$totalChunks}] handling " . count($ids) . " candidates");
                Log::debug('candidate:journey:backfill.chunk.start', ['chunk' => $chunkIndex, 'size' => count($ids)]);

                if ($dryRun) {
                    $processed += count($ids);
                    $this->info("[chunk {$chunkIndex}] dry-run - skipped processing");
                    Log::info('candidate:journey:backfill.chunk.dryrun', ['chunk' => $chunkIndex, 'size' => count($ids)]);
                    return;
                }

                if ($enqueue) {
                    BackfillCandidateJourneyChunk::dispatch($ids, true);
                    $this->info("[chunk {$chunkIndex}] enqueued job for " . count($ids) . " candidates");
                    Log::info('candidate:journey:backfill.chunk.enqueued', ['chunk' => $chunkIndex, 'size' => count($ids)]);
                } else {
                    $count = $recorder->captureBatch($ids, true);

                    $this->info("[chunk {$chunkIndex}] processed " . count($ids) . " candidates — recorded {$count} events");
                    Log::info('candidate:journey:backfill.chunk.processed', ['chunk' => $chunkIndex, 'size' => count($ids), 'events' => $count]);
                }

                $processed += count($ids);
            });

            $this->info("Backfill complete — processed {$processed} candidates.");

            return 0;
        }

        foreach ($candidates as $candidate) {
            /** @var Candidate $candidate */
            $this->processCandidate($recorder, $candidate, $dryRun);
        }

        return 0;
    }

    private function processCandidate(CandidateJourneyAnalyticsRecorder $recorder, Candidate $candidate, bool $dryRun): void
    {
        if ($dryRun) {
            return;
        }

        // The recorder::capture contract is intentionally minimal so it can be mocked in tests.
        $recorder->capture($candidate, true);
    }
}
