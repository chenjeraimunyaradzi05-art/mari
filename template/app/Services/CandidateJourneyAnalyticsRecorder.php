<?php

namespace App\Services;

use App\Jobs\PersistAnalyticsEvent;
use App\Models\AnalyticsEvent;
use App\Models\Candidate;
use App\Services\RealTimeAnalyticsEngine;

/**
 * Minimal, test-friendly candidate journey analytics recorder.
 *
 * This is intentionally a lightweight no-op implementation so the container
 * can resolve the service during tests and the real recording logic can be
 * implemented later.
 */
class CandidateJourneyAnalyticsRecorder
{
    public function __construct(private readonly RealTimeAnalyticsEngine $engine)
    {
    }
    /**
     * Capture analytics for a single candidate.
     *
     * @param Candidate|int $candidate Candidate model or id
     * @param bool $force Whether to force writing even when data exists
     * @return int A simple numeric result (e.g. number of records persisted)
     */
    /**
     * Capture per-candidate journey events.
     * Returns the number of events recorded.
     */
    public function capture($candidate, bool $force = true): int
    {
        // Accept id or model
        $candidateModel = $candidate instanceof Candidate ? $candidate : Candidate::find($candidate);

        if (! $candidateModel) {
            return 0;
        }

        $events = [];

        // Always add a generic recorded event for the candidate (acts as marker)
        $events[] = [
            'event' => 'candidate.journey.recorded',
            'payload' => [
                'properties' => [
                    'candidate_id' => $candidateModel->id,
                    'user_id' => $candidateModel->user_id ?? null,
                    'created_at' => optional($candidateModel->created_at)->toIso8601String(),
                    'profile_complete' => (int) ($candidateModel->profile_complete ?? 0),
                ],
                'metadata' => ['source' => 'backfill'],
                'source' => 'backfill',
                'received_at' => now(),
            ],
        ];

        // Profile completion event
        if (! empty($candidateModel->profile_complete)) {
            $events[] = [
                'event' => 'candidate.journey.profile_completed',
                'payload' => [
                    'properties' => [
                        'candidate_id' => $candidateModel->id,
                        'profile_complete' => (int) $candidateModel->profile_complete,
                    ],
                    'metadata' => ['source' => 'backfill'],
                    'source' => 'backfill',
                    'received_at' => now(),
                ],
            ];
        }

        // CV uploaded event
        if (! empty($candidateModel->cv)) {
            $events[] = [
                'event' => 'candidate.journey.cv_uploaded',
                'payload' => [
                    'properties' => [
                        'candidate_id' => $candidateModel->id,
                        'cv' => $candidateModel->cv,
                    ],
                    'metadata' => ['source' => 'backfill'],
                    'source' => 'backfill',
                    'received_at' => now(),
                ],
            ];
        }

        // Social profile added
        try {
            if ($candidateModel->relationLoaded('socialProfile') || method_exists($candidateModel, 'socialProfile')) {
                $hasSocial = (bool) ($candidateModel->socialProfile()->exists());
            } else {
                $hasSocial = false;
            }
        } catch (\Throwable $e) {
            $hasSocial = false;
        }

        if ($hasSocial) {
            $events[] = [
                'event' => 'candidate.journey.social_profile_added',
                'payload' => [
                    'properties' => ['candidate_id' => $candidateModel->id],
                    'metadata' => ['source' => 'backfill'],
                    'source' => 'backfill',
                    'received_at' => now(),
                ],
            ];
        }

        // Interview scheduled/completed marker - if the candidate already has any interview sessions
        try {
            $hasInterview = \App\Models\InterviewSession::query()->where('candidate_id', $candidateModel->id)->exists();
        } catch (\Throwable $e) {
            $hasInterview = false;
        }

        if ($hasInterview) {
            $events[] = [
                'event' => 'candidate.journey.interview_scheduled',
                'payload' => [
                    'properties' => ['candidate_id' => $candidateModel->id],
                    'metadata' => ['source' => 'backfill'],
                    'source' => 'backfill',
                    'received_at' => now(),
                ],
            ];
        }

        // When not forcing, filter out any events that already exist in DB
        if (! $force) {
            $filtered = [];

            foreach ($events as $item) {
                $event = $item['event'];
                $candidateId = $item['payload']['properties']['candidate_id'] ?? null;

                $exists = AnalyticsEvent::query()
                    ->where('event', $event)
                    ->whereJsonContains('properties->candidate_id', $candidateId)
                    ->exists();

                if (! $exists) {
                    $filtered[] = $item;
                }
            }

            $events = $filtered;
        }

        if (empty($events)) {
            return 0;
        }

        // Use individual writes for single candidate capture (keep contract simple)
        foreach ($events as $item) {
            $this->engine->record($item['event'], $item['payload']);
        }

        return count($events);
    }

    /**
     * Capture a batch of candidates efficiently using recordBatch.
     * Accepts an array of Candidate models or arrays with candidate properties.
     * Returns the total number of events recorded across the batch.
     */
    public function captureBatch(array $candidates, bool $force = true): int
    {
        $events = [];

        foreach ($candidates as $candidate) {
            $candidateModel = $candidate instanceof Candidate ? $candidate : Candidate::find($candidate['id'] ?? $candidate);

            if (! $candidateModel) {
                continue;
            }

            // Generic marker
            $events[] = [
                'event' => 'candidate.journey.recorded',
                'payload' => [
                    'properties' => [
                        'candidate_id' => $candidateModel->id,
                        'user_id' => $candidateModel->user_id ?? null,
                    ],
                    'metadata' => ['source' => 'backfill'],
                    'source' => 'backfill',
                    'received_at' => now(),
                ],
            ];

            if (! empty($candidateModel->profile_complete)) {
                $events[] = [
                    'event' => 'candidate.journey.profile_completed',
                    'payload' => [
                        'properties' => ['candidate_id' => $candidateModel->id, 'profile_complete' => (int) $candidateModel->profile_complete],
                        'metadata' => ['source' => 'backfill'],
                        'source' => 'backfill',
                        'received_at' => now(),
                    ],
                ];
            }

            if (! empty($candidateModel->cv)) {
                $events[] = [
                    'event' => 'candidate.journey.cv_uploaded',
                    'payload' => [
                        'properties' => ['candidate_id' => $candidateModel->id, 'cv' => $candidateModel->cv],
                        'metadata' => ['source' => 'backfill'],
                        'source' => 'backfill',
                        'received_at' => now(),
                    ],
                ];
            }

            // social profile
            try {
                $hasSocial = (bool) ($candidateModel->socialProfile()->exists());
            } catch (\Throwable $e) {
                $hasSocial = false;
            }

            if ($hasSocial) {
                $events[] = [
                    'event' => 'candidate.journey.social_profile_added',
                    'payload' => [
                        'properties' => ['candidate_id' => $candidateModel->id],
                        'metadata' => ['source' => 'backfill'],
                        'source' => 'backfill',
                        'received_at' => now(),
                    ],
                ];
            }

            // interviews
            try {
                $hasInterview = \App\Models\InterviewSession::query()->where('candidate_id', $candidateModel->id)->exists();
            } catch (\Throwable $e) {
                $hasInterview = false;
            }

            if ($hasInterview) {
                $events[] = [
                    'event' => 'candidate.journey.interview_scheduled',
                    'payload' => [
                        'properties' => ['candidate_id' => $candidateModel->id],
                        'metadata' => ['source' => 'backfill'],
                        'source' => 'backfill',
                        'received_at' => now(),
                    ],
                ];
            }
        }

        // If not forcing, filter events that already exist
        if (! $force) {
            $filtered = [];

            foreach ($events as $item) {
                $event = $item['event'];
                $candidateId = $item['payload']['properties']['candidate_id'] ?? null;

                $exists = AnalyticsEvent::query()
                    ->where('event', $event)
                    ->whereJsonContains('properties->candidate_id', $candidateId)
                    ->exists();

                if (! $exists) {
                    $filtered[] = $item;
                }
            }

            $events = $filtered;
        }

        if (empty($events)) {
            return 0;
        }

        // Use engine.recordBatch so the engine can decide the right ingestion mode
        $this->engine->recordBatch($events);

        return count($events);
    }
}
