<?php

namespace App\Services;

use App\Models\DreamJobAlert;
use App\Models\Job;
use App\Models\JobAlertMatch;
use App\Services\AthenaAIService;
use Illuminate\Support\Carbon;

final class DreamJobMatcherService
{
    public function __construct(private AthenaAIService $ai)
    {
    }

    /**
     * Match active alerts to recent jobs and persist matches.
     */
    public function runForActiveAlerts(): void
    {
        $alerts = DreamJobAlert::query()->where('is_active', true)->get();

        foreach ($alerts as $alert) {
            $this->matchAlert($alert);
        }
    }

    public function matchAlert(DreamJobAlert $alert): void
    {
        $query = Job::query()->whereIn('status', ['active', 'published']);

        // Simple heuristics
        if ($alert->job_title) {
            $query->where('title', 'like', '%'.$alert->job_title.'%');
        }

        if ($alert->location) {
            $query->orWhere('address', 'like', '%'.$alert->location.'%');
        }

        if ($alert->required_skills && is_array($alert->required_skills)) {
            foreach ($alert->required_skills as $skill) {
                $query->orWhere('description', 'like', '%'.$skill.'%');
            }
        }

        $jobs = $query->take(10)->get();

        foreach ($jobs as $job) {
            // Dedupe: don't create duplicate match records for same alert+job
            $exists = JobAlertMatch::query()
                ->where('dream_job_alert_id', $alert->id)
                ->where('job_posting_id', $job->id)
                ->exists();

            if ($exists) {
                continue;
            }

            // Prefer AI-driven scoring/explanation where available
            $scorePayload = $this->ai->scoreMatch($alert->user, $job);

            $score = isset($scorePayload['score']) ? (int) $scorePayload['score'] : rand(50, 95);
            $explanation = $scorePayload['explanation'] ?? null;

            $reasons = [];
            if ($alert->job_title && str_contains(strtolower($job->title), strtolower($alert->job_title))) {
                $reasons[] = 'Title match';
            }

            if ($alert->location && str_contains(strtolower($job->address ?? ''), strtolower($alert->location))) {
                $reasons[] = 'Location match';
            }

            JobAlertMatch::create([
                'dream_job_alert_id' => $alert->id,
                'job_posting_id' => $job->id,
                'match_score' => $score,
                'match_reasons' => $reasons,
                'explanation' => $explanation,
            ]);
        }

        $alert->last_matched_at = now();
        $alert->save();
    }
}
