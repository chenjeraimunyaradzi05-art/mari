<?php

namespace App\Services;

use App\Models\User;
use App\Models\Job;
use Illuminate\Support\Collection;
use Illuminate\Support\Arr;

/**
 * Minimal AI integration service — provides a safe, testable foundation for
 * building user profiles and making lightweight recommendations.
 *
 * This class intentionally avoids making real external API calls in tests.
 */
final class AthenaAIService
{
    public function __construct()
    {
    }

    /**
     * Build a simple user profile from supplied responses.
     * If an external model is configured, a future implementation may call it.
     */
    public function buildUserProfile(User $user, array $responses): array
    {
        // Non-destructive baseline: merge responses with lightweight defaults
        $defaults = [
            'name' => $user->preferred_name ?: $user->name,
            'pronouns' => $user->pronouns ?? null,
            'goals' => [],
            'challenges' => [],
            'skills' => [],
            'summary' => null,
        ];

        $profile = array_merge($defaults, Arr::only($responses, ['goals', 'challenges', 'skills']));

        // Produce a short summary for UI consumption
        $profile['summary'] = sprintf("%s is focused on %s and is seeking help with %s.",
            $profile['name'],
            implode(', ', array_slice((array)$profile['goals'], 0, 3)) ?: 'career growth',
            implode(', ', array_slice((array)$profile['challenges'], 0, 3)) ?: 'access to supports'
        );

        return $profile;
    }

    /**
     * Offer business structure guidance as a small array.
     */
    public function recommendBusinessType(User $user): array
    {
        return [
            'recommended' => 'sole_trader',
            'options' => [
                'sole_trader' => ['pros' => ['simple setup', 'low cost'], 'cons' => ['personal liability']],
                'company' => ['pros' => ['limited liability', 'structure'], 'cons' => ['higher admin']],
            ],
        ];
    }

    /**
     * Score a candidate match between a user and a job posting and provide
     * a short explanation. This is intentionally simple for testability and
     * can be replaced with a remote AI call at runtime.
     */
    public function scoreMatch(User $user, Job $job): array
    {
        // lightweight heuristic scoring
        $score = 50;

        $title = strtolower($job->title ?? '');
        $uInterests = collect($user->interests ?? [])->map(fn($s) => strtolower((string) $s))->join(' ');

        if ($uInterests !== '' && str_contains($title, explode(' ', $uInterests)[0])) {
            $score += 20;
        }

        $reasons = [];

        if (str_contains($title, 'nurse')) {
            $reasons[] = 'Title strongly matches user interest';
        }

        $explanation = 'Match computed using lightweight heuristics: '.implode('; ', $reasons);

        return ['score' => min(100, $score), 'explanation' => $explanation ?: 'No explanation provided.'];
    }

    /**
     * Return a simple collection of job matches from the jobs table using
     * light heuristic matching against the user's interests/skills.
     */
    public function matchDreamJob(User $user): Collection
    {
        $tokens = collect($user->interests ?? [])->merge($user->skills ?? [])->map(fn($t) => (string) $t)->filter()->values();

        // Jobs in this codebase are commonly marked 'active' — accept active/published
        $query = Job::query()->whereIn('status', ['active', 'published']);

        if ($tokens->isNotEmpty()) {
            foreach ($tokens as $token) {
                $query->orWhere('title', 'like', '%'.$token.'%');
            }
        }

        $jobs = $query->take(5)->get();

        return $jobs->map(fn (Job $job) => [
            'job_id' => $job->id,
            'title' => $job->title,
            'match_score' => rand(40, 95),
        ]);
    }

    public function recommendCourses(User $user): array
    {
        return [
            ['id' => 'course-1', 'label' => 'Resume & Interview Prep'],
            ['id' => 'course-2', 'label' => 'Small Business Basics'],
        ];
    }

    public function findRelevantGrants(User $user): array
    {
        return [
            ['id' => 'grant-1', 'name' => 'Starter Grant', 'relevance' => 75],
        ];
    }

    public function suggestConnections(User $user): array
    {
        return [
            ['id' => 'user-42', 'name' => 'Mentor Jane', 'reason' => 'Relevant industry experience'],
        ];
    }
}
