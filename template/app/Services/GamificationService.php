<?php

namespace App\Services;

use App\Models\Candidate;
use App\Models\CandidatePoint;
use App\Models\PointTransaction;
use App\Models\Badge;
use App\Models\CandidateBadge;
use App\Models\Challenge;
use App\Models\CandidateChallenge;
use App\Models\Milestone;
use App\Models\CandidateMilestone;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class GamificationService
{
    /**
     * Point values for different actions
     */
    const POINTS = [
        'profile_complete' => 100,
        'profile_image_upload' => 20,
        'bio_added' => 30,
        'experience_added' => 25,
        'education_added' => 20,
        'skill_added' => 10,
        'language_added' => 10,
        'cv_uploaded' => 50,
        'job_applied' => 15,
        'job_bookmarked' => 5,
        'interview_session_completed' => 50,
        'interview_score_excellent' => 30,
        'skill_gap_analysis' => 40,
        'learning_resource_started' => 20,
        'learning_resource_completed' => 100,
        'daily_login' => 5,
        'weekly_streak_maintained' => 50,
        'challenge_completed' => 0, // Dynamic based on challenge
        'badge_earned' => 0, // Dynamic based on badge
    ];

    /**
     * Award points to candidate
     */
    public function awardPoints(Candidate $candidate, string $action, string $description, array $metadata = []): CandidatePoint|null
    {
        $points = self::POINTS[$action] ?? 0;

        if ($points == 0) {
            // Dynamic points from metadata
            $points = $metadata['points'] ?? 0;
        }

        $candidatePoints = $this->getOrCreateCandidatePoints($candidate);
        $candidatePoints->addPoints($points, $action, $description, $metadata);

        // Check for badge eligibility
        $this->checkBadgeEligibility($candidate);

        // Check for milestone achievements
        $this->checkMilestoneAchievements($candidate);

        return $candidatePoints->fresh();
    }

    /**
     * Get or create candidate points record
     */
    public function getOrCreateCandidatePoints(Candidate $candidate): CandidatePoint
    {
        return CandidatePoint::firstOrCreate(
            ['candidate_id' => $candidate->id],
            [
                'total_points' => 0,
                'current_level' => 1,
                'points_to_next_level' => 100,
                'lifetime_points' => 0,
                'monthly_points' => 0,
                'weekly_points' => 0,
                'streak_days' => 0,
            ]
        );
    }

    /**
     * Check and award eligible badges
     */
    public function checkBadgeEligibility(Candidate $candidate): void
    {
        $badges = Badge::active()->get();

        foreach ($badges as $badge) {
            // Skip if already earned
            if ($this->hasBadge($candidate, $badge)) {
                continue;
            }

            // Check if criteria is met
            if ($this->checkBadgeCriteria($candidate, $badge)) {
                $this->awardBadge($candidate, $badge);
            }
        }
    }

    /**
     * Check if badge criteria is met
     */
    protected function checkBadgeCriteria(Candidate $candidate, Badge $badge): bool
    {
        $criteria = $badge->criteria;

        if (empty($criteria)) {
            return false;
        }

        // Check each criterion
        foreach ($criteria as $key => $value) {
            switch ($key) {
                case 'total_points':
                    $candidatePoints = $this->getOrCreateCandidatePoints($candidate);
                    if ($candidatePoints->total_points < $value) {
                        return false;
                    }
                    break;

                case 'level':
                    $candidatePoints = $this->getOrCreateCandidatePoints($candidate);
                    if ($candidatePoints->current_level < $value) {
                        return false;
                    }
                    break;

                case 'job_applications':
                    if ($candidate->appliedJobs()->count() < $value) {
                        return false;
                    }
                    break;

                case 'skills_count':
                    if ($candidate->skills()->count() < $value) {
                        return false;
                    }
                    break;

                case 'interview_sessions':
                    if ($candidate->interviewSessions()->count() < $value) {
                        return false;
                    }
                    break;

                case 'learning_completed':
                    if ($candidate->learningProgress()->where('status', 'completed')->count() < $value) {
                        return false;
                    }
                    break;

                case 'streak_days':
                    $candidatePoints = $this->getOrCreateCandidatePoints($candidate);
                    if ($candidatePoints->streak_days < $value) {
                        return false;
                    }
                    break;
            }
        }

        return true;
    }

    /**
     * Award badge to candidate
     */
    public function awardBadge(Candidate $candidate, Badge $badge): CandidateBadge
    {
        $candidateBadge = CandidateBadge::create([
            'candidate_id' => $candidate->id,
            'badge_id' => $badge->id,
            'earned_at' => now(),
            'progress_percentage' => 100,
        ]);

        // Award points if applicable
        if ($badge->points_reward > 0) {
            $this->awardPoints($candidate, 'badge_earned', "Earned badge: {$badge->name}", [
                'badge_id' => $badge->id,
                'points' => $badge->points_reward,
            ]);
        }

        // Increment badge earned count
        $badge->incrementEarnedCount();

        return $candidateBadge;
    }

    /**
     * Check if candidate has badge
     */
    public function hasBadge(Candidate $candidate, Badge $badge): bool
    {
        return CandidateBadge::where('candidate_id', $candidate->id)
            ->where('badge_id', $badge->id)
            ->exists();
    }

    /**
     * Check and award milestone achievements
     */
    public function checkMilestoneAchievements(Candidate $candidate): void
    {
        $milestones = Milestone::active()->get();

        foreach ($milestones as $milestone) {
            // Skip if already achieved
            if ($this->hasMilestone($candidate, $milestone)) {
                continue;
            }

            // Check if threshold is met
            if ($this->checkMilestoneThreshold($candidate, $milestone)) {
                $this->awardMilestone($candidate, $milestone);
            }
        }
    }

    /**
     * Check if milestone threshold is met
     */
    protected function checkMilestoneThreshold(Candidate $candidate, Milestone $milestone): bool
    {
        $value = 0;

        switch ($milestone->category) {
            case 'points':
                $candidatePoints = $this->getOrCreateCandidatePoints($candidate);
                $value = $candidatePoints->total_points;
                break;

            case 'level':
                $candidatePoints = $this->getOrCreateCandidatePoints($candidate);
                $value = $candidatePoints->current_level;
                break;

            case 'badges':
                $value = CandidateBadge::where('candidate_id', $candidate->id)->count();
                break;

            case 'applications':
                $value = $candidate->appliedJobs()->count();
                break;

            case 'skills':
                $value = $candidate->skills()->count();
                break;
        }

        return $value >= $milestone->threshold;
    }

    /**
     * Award milestone to candidate
     */
    public function awardMilestone(Candidate $candidate, Milestone $milestone): CandidateMilestone
    {
        $candidateMilestone = CandidateMilestone::create([
            'candidate_id' => $candidate->id,
            'milestone_id' => $milestone->id,
            'achieved_at' => now(),
            'value_at_achievement' => $this->getCurrentMilestoneValue($candidate, $milestone),
        ]);

        // Award points
        if ($milestone->points_reward > 0) {
            $this->awardPoints($candidate, 'milestone_achieved', "Achieved milestone: {$milestone->name}", [
                'milestone_id' => $milestone->id,
                'points' => $milestone->points_reward,
            ]);
        }

        // Award badge if applicable
        if ($milestone->badge_id) {
            $badge = Badge::find($milestone->badge_id);
            if ($badge && !$this->hasBadge($candidate, $badge)) {
                $this->awardBadge($candidate, $badge);
            }
        }

        $milestone->increment('achieved_count');

        return $candidateMilestone;
    }

    /**
     * Get current value for milestone category
     */
    protected function getCurrentMilestoneValue(Candidate $candidate, Milestone $milestone): int
    {
        switch ($milestone->category) {
            case 'points':
                return $this->getOrCreateCandidatePoints($candidate)->total_points;
            case 'level':
                return $this->getOrCreateCandidatePoints($candidate)->current_level;
            case 'badges':
                return CandidateBadge::where('candidate_id', $candidate->id)->count();
            case 'applications':
                return $candidate->appliedJobs()->count();
            case 'skills':
                return $candidate->skills()->count();
            default:
                return 0;
        }
    }

    /**
     * Check if candidate has milestone
     */
    public function hasMilestone(Candidate $candidate, Milestone $milestone): bool
    {
        return CandidateMilestone::where('candidate_id', $candidate->id)
            ->where('milestone_id', $milestone->id)
            ->exists();
    }

    /**
     * Start challenge for candidate
     */
    public function startChallenge(Candidate $candidate, Challenge $challenge): CandidateChallenge
    {
        // Check if already participating
        $existing = CandidateChallenge::where('candidate_id', $candidate->id)
            ->where('challenge_id', $challenge->id)
            ->whereIn('status', ['in_progress'])
            ->first();

        if ($existing) {
            return $existing;
        }

        $candidateChallenge = CandidateChallenge::create([
            'candidate_id' => $candidate->id,
            'challenge_id' => $challenge->id,
            'status' => 'in_progress',
            'current_progress' => 0,
            'target_value' => $challenge->target_value,
            'progress_percentage' => 0,
            'started_at' => now(),
            'expires_at' => $challenge->end_date,
        ]);

        $challenge->increment('participants_count');

        return $candidateChallenge;
    }

    /**
     * Complete challenge and award rewards
     */
    public function completeChallenge(CandidateChallenge $candidateChallenge): void
    {
        $challenge = $candidateChallenge->challenge;
        $candidate = $candidateChallenge->candidate;

        // Award points
        if ($challenge->points_reward > 0) {
            $this->awardPoints($candidate, 'challenge_completed', "Completed challenge: {$challenge->title}", [
                'challenge_id' => $challenge->id,
                'points' => $challenge->points_reward,
            ]);
        }

        // Award badge if applicable
        if ($challenge->badge_id) {
            $badge = Badge::find($challenge->badge_id);
            if ($badge && !$this->hasBadge($candidate, $badge)) {
                $this->awardBadge($candidate, $badge);
            }
        }

        $challenge->increment('completions_count');
    }

    /**
     * Get leaderboard rankings
     *
     * @psalm-return Collection<int, CandidatePoint>|\Illuminate\Database\Eloquent\Collection<int, CandidatePoint>
     */
    public function getLeaderboard(string $type = 'all_time', int $limit = 10): Collection|\Illuminate\Database\Eloquent\Collection
    {
        $query = CandidatePoint::with(['candidate.user']);

        switch ($type) {
            case 'monthly':
                $query->orderByDesc('monthly_points');
                break;
            case 'weekly':
                $query->orderByDesc('weekly_points');
                break;
            default:
                $query->orderByDesc('total_points');
        }

        $results = $query->take($limit)->get();

        return $results->values()->map(function (CandidatePoint $points, int $index) {
            $candidate = $points->candidate;
            $user = $candidate?->user;

            $points->setAttribute('rank', $index + 1);
            $points->setAttribute('name', $candidate?->full_name
                ?? $candidate?->preferred_name
                ?? $user?->name
                ?? 'Athena member');
            $points->setAttribute('title', $candidate?->headline
                ?? $candidate?->current_job_title
                ?? 'Role not provided');
            $points->setAttribute('score', $points->total_points);
            $points->setAttribute('streak_days', $points->streak_days);
            $points->setAttribute('level_color', $points->level_color);
            $points->setAttribute('current_level', $points->current_level);
            $points->setAttribute('points_meta', [
                'total' => $points->total_points,
                'monthly' => $points->monthly_points,
                'weekly' => $points->weekly_points,
            ]);

            return $points;
        });
    }

    /**
     * Get candidate's gamification stats
     *
     * @return ((float|int|mixed|string)[]|int|mixed)[]
     *
     * @psalm-return array{points: array{total: int, monthly: int, weekly: int, lifetime: int}, level: array{current: int, title: string, progress: float, next_level_points: int}, streak: int, badges: array{earned: mixed, showcased: mixed, recent: mixed}, challenges: array{active: mixed, completed: mixed}, milestones: mixed, rank: int}
     */
    public function getCandidateStats(Candidate $candidate): array
    {
        $candidatePoints = $this->getOrCreateCandidatePoints($candidate);

        return [
            'points' => [
                'total' => $candidatePoints->total_points,
                'monthly' => $candidatePoints->monthly_points,
                'weekly' => $candidatePoints->weekly_points,
                'lifetime' => $candidatePoints->lifetime_points,
            ],
            'level' => [
                'current' => $candidatePoints->current_level,
                'title' => $candidatePoints->level_title,
                'progress' => $candidatePoints->progress_to_next_level,
                'next_level_points' => $candidatePoints->points_to_next_level,
            ],
            'streak' => $candidatePoints->streak_days,
            'badges' => [
                'earned' => CandidateBadge::where('candidate_id', $candidate->id)->count(),
                'showcased' => CandidateBadge::where('candidate_id', $candidate->id)
                    ->where('is_showcased', true)->count(),
                'recent' => CandidateBadge::where('candidate_id', $candidate->id)
                    ->recentlyEarned()->count(),
            ],
            'challenges' => [
                'active' => CandidateChallenge::where('candidate_id', $candidate->id)
                    ->where('status', 'in_progress')->count(),
                'completed' => CandidateChallenge::where('candidate_id', $candidate->id)
                    ->where('status', 'completed')->count(),
            ],
            'milestones' => CandidateMilestone::where('candidate_id', $candidate->id)->count(),
            'rank' => $this->getCandidateRank($candidate),
        ];
    }

    /**
     * Get candidate's rank
     */
    public function getCandidateRank(Candidate $candidate): int
    {
        $candidatePoints = $this->getOrCreateCandidatePoints($candidate);

        return CandidatePoint::where('total_points', '>', $candidatePoints->total_points)->count() + 1;
    }

    /**
     * Get recent activity
     */
    public function getRecentActivity(Candidate $candidate, int $limit = 10): Collection
    {
        return PointTransaction::where('candidate_id', $candidate->id)
            ->orderByDesc('created_at')
            ->take($limit)
            ->get();
    }
}

