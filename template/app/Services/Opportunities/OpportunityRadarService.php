<?php

namespace App\Services\Opportunities;

use App\Models\User;
use App\Models\Job;
use App\Models\Course;
use App\Models\OpportunityRadarEntry;
use App\Models\Candidate;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

final class OpportunityRadarService
{
    /**
     * Run the radar scan for a specific user.
     */
    public function runForUser(User $user): void
    {
        $candidate = $user->candidate;

        // If no candidate profile, we can't match much yet.
        // In future, we might match based on other user attributes.
        if (!$candidate) {
            return;
        }

        // We'll keep track of created entries to avoid duplicates in this run
        // But we might want to update scores if they change.

        $this->scanJobs($user, $candidate);
        $this->scanCourses($user, $candidate);

        // Find un-notified high scoring entries
        $newEntries = OpportunityRadarEntry::where('user_id', $user->id)
            ->whereNull('notified_at')
            ->where('score', '>=', 50) // Only notify for good matches
            ->get();

        if ($newEntries->isNotEmpty()) {
            $user->notify(new \App\Notifications\OpportunityRadarAlert($newEntries));

            // Mark as notified
            OpportunityRadarEntry::whereIn('id', $newEntries->pluck('id'))
                ->update(['notified_at' => now()]);
        }
    }

    /**
     * Scan for Jobs matching the candidate.
     */
    protected function scanJobs(User $user, Candidate $candidate): void
    {
        // Fetch active jobs
        $jobs = Job::query()
            ->where('status', 'active')
            ->where('deadline', '>', now())
            ->get();

        foreach ($jobs as $job) {
            $score = 0;
            $reasons = [];

            // 1. Location Match (30 pts)
            if ($candidate->city && $job->city_id == $candidate->city) {
                $score += 30;
                $reasons[] = 'Matches your city';
            } elseif ($candidate->state && $job->state_id == $candidate->state) {
                $score += 15;
                $reasons[] = 'Matches your state';
            }

            // 2. Category Match (40 pts)
            if ($candidate->job_category_id && $job->job_category_id == $candidate->job_category_id) {
                $score += 40;
                $reasons[] = 'Matches your preferred industry';
            }

            // 3. Role Match (20 pts) - assuming we can match role IDs or similar
            if ($candidate->job_role_id && $job->job_role_id == $candidate->job_role_id) {
                $score += 20;
                $reasons[] = 'Matches your specific role';
            }

            // 4. Urgency Calculation
            $daysUntilDeadline = now()->diffInDays(Carbon::parse($job->deadline), false);
            if ($daysUntilDeadline <= 3) {
                $urgency = 90; // Very urgent
            } elseif ($daysUntilDeadline <= 7) {
                $urgency = 60;
            } else {
                $urgency = 20;
            }

            // Threshold to save
            if ($score >= 40) {
                $this->saveEntry(
                    $user,
                    'job',
                    $job->id,
                    $job->title,
                    $job->company->name ?? 'Unknown Company', // Assuming company relation
                    Str::limit($job->description, 100),
                    $score,
                    $urgency,
                    $reasons,
                    route('job.show', $job->slug ?? $job->id), // Assuming route exists
                    Carbon::parse($job->deadline)
                );
            }
        }
    }

    /**
     * Scan for Courses matching the candidate.
     */
    protected function scanCourses(User $user, Candidate $candidate): void
    {
        // Fetch active courses
        $courses = Course::query()
            ->where('status', 'published')
            ->get();

        foreach ($courses as $course) {
            $score = 0;
            $reasons = [];
            $urgency = 10; // Default low urgency for courses unless intake closing

            // 1. Location Match (20 pts) - Courses might be online
            if ($course->mode === 'online') {
                $score += 10;
                $reasons[] = 'Online course available anywhere';
            } elseif ($candidate->city && str_contains($course->location, $candidate->city_name)) { // Simplified check
                $score += 20;
                $reasons[] = 'Course available in your city';
            }

            // 2. Interest Match (50 pts)
            // This is harder without explicit "interests" vs "course tags" mapping.
            // We'll use a simple text match for now or category if available.
            // Assuming Course has a category or similar, or we match title against dream job.

            if ($candidate->dream_job && stripos($course->title, $candidate->dream_job) !== false) {
                $score += 50;
                $reasons[] = 'Aligns with your dream job';
            }

            // Threshold
            if ($score >= 30) {
                $this->saveEntry(
                    $user,
                    'course',
                    $course->id,
                    $course->title,
                    $course->provider_name ?? 'Education Provider',
                    $course->summary,
                    $score,
                    $urgency,
                    $reasons,
                    route('courses.show', $course->slug ?? $course->id),
                    null
                );
            }
        }
    }

    protected function saveEntry(
        User $user,
        string $type,
        int $id,
        string $title,
        string $subtitle,
        ?string $summary,
        int $score,
        int $urgency,
        array $reasons,
        string $url,
        ?Carbon $expiresAt
    ): void {
        OpportunityRadarEntry::updateOrCreate(
            [
                'user_id' => $user->id,
                'opportunity_type' => $type,
                'opportunity_id' => $id,
            ],
            [
                'title' => $title,
                'subtitle' => $subtitle,
                'summary' => $summary,
                'score' => $score,
                'urgency_level' => $urgency,
                'fit_reasons' => $reasons,
                'action_url' => $url,
                'expires_at' => $expiresAt,
                // notified_at is managed by the notification command
            ]
        );
    }
}

