<?php

namespace App\Services;

use App\Jobs\BatchProcessResumesJob;
use App\Jobs\BatchJobMatchingJob;
use App\Jobs\GenerateCareerInsightsJob;
use App\Models\Candidate;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Batch Processing Service
 *
 * Handles bulk AI operations with progress tracking and parallel processing
 */
final class BatchProcessingService
{


    /**
     * Get batch processing progress
     */
    public function getBatchProgress(string $batchId): array
    {
        $cacheKey = "batch_progress:{$batchId}";
        $progress = Cache::get($cacheKey, [
            'batch_id' => $batchId,
            'total' => 0,
            'completed' => 0,
            'failed' => 0,
            'status' => 'unknown',
            'type' => 'unknown',
            'started_at' => null,
            'completed_at' => null,
        ]);

        // Calculate percentage
        $progress['percentage'] = $progress['total'] > 0
            ? round(($progress['completed'] / $progress['total']) * 100, 2)
            : 0;

        // Calculate estimated time remaining
        if ($progress['completed'] > 0 && $progress['started_at']) {
            $elapsed = time() - strtotime($progress['started_at']);
            $avgTimePerItem = $elapsed / $progress['completed'];
            $remaining = $progress['total'] - $progress['completed'];
            $progress['estimated_time_remaining'] = round($avgTimePerItem * $remaining);
        }

        return $progress;
    }

    /**
     * Initialize batch tracking
     */
    private function initializeBatch(string $batchId, int $total, string $type): void
    {
        $cacheKey = "batch_progress:{$batchId}";

        $data = [
            'batch_id' => $batchId,
            'total' => $total,
            'completed' => 0,
            'failed' => 0,
            'status' => 'processing',
            'type' => $type,
            'started_at' => now()->toDateTimeString(),
            'completed_at' => null,
            'errors' => [],
        ];

        Cache::put($cacheKey, $data, 86400); // Keep for 24 hours

        // Track active batches
        $activeBatches = Cache::get('active_batch_ids', []);
        $activeBatches[] = $batchId;
        Cache::put('active_batch_ids', $activeBatches, 86400);
    }

    /**
     * Update batch progress
     */
    public function updateBatchProgress(string $batchId, int $completed = 0, int $failed = 0, ?string $error = null): void
    {
        $cacheKey = "batch_progress:{$batchId}";
        $progress = Cache::get($cacheKey);

        if (!$progress) {
            return;
        }

        $progress['completed'] += $completed;
        $progress['failed'] += $failed;

        if ($error) {
            $progress['errors'][] = [
                'time' => now()->toDateTimeString(),
                'message' => $error,
            ];
        }

        // Check if batch is complete
        if (($progress['completed'] + $progress['failed']) >= $progress['total']) {
            $progress['status'] = 'completed';
            $progress['completed_at'] = now()->toDateTimeString();
        }

        Cache::put($cacheKey, $progress, 86400);
    }
}

