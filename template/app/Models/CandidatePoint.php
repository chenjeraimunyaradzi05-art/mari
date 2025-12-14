<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $candidate_id
 * @property int $total_points
 * @property int $current_level
 * @property int $points_to_next_level
 * @property int $lifetime_points
 * @property int $monthly_points
 * @property int $weekly_points
 * @property \Illuminate\Support\Carbon|null $last_monthly_reset
 * @property \Illuminate\Support\Carbon|null $last_weekly_reset
 * @property int $streak_days
 * @property \Illuminate\Support\Carbon|null $last_activity_date
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Candidate $candidate
 * @property-read string $level_color
 * @property-read string $level_title
 * @property-read float $progress_to_next_level
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PointTransaction> $transactions
 * @property int|null transactions_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint whereCurrentLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint whereLastActivityDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint whereLastMonthlyReset($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint whereLastWeeklyReset($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint whereLifetimePoints($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint whereMonthlyPoints($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint wherePointsToNextLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint whereStreakDays($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint whereTotalPoints($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoint whereWeeklyPoints($value)
 *
 * @mixin \Eloquent
 */
final class CandidatePoint extends Model
{
    protected $fillable = [
        'candidate_id',
        'total_points',
        'current_level',
        'points_to_next_level',
        'lifetime_points',
        'monthly_points',
        'weekly_points',
        'last_monthly_reset',
        'last_weekly_reset',
        'streak_days',
        'last_activity_date',
    ];

    protected $casts = [
        'total_points' => 'integer',
        'current_level' => 'integer',
        'points_to_next_level' => 'integer',
        'lifetime_points' => 'integer',
        'monthly_points' => 'integer',
        'weekly_points' => 'integer',
        'last_monthly_reset' => 'date',
        'last_weekly_reset' => 'date',
        'streak_days' => 'integer',
        'last_activity_date' => 'date',
    ];

    /**
     * Get the candidate
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    /**
     * Get point transactions
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(PointTransaction::class, 'candidate_id', 'candidate_id');
    }

    /**
     * Add points
     */
    public function addPoints(int $points, string $action, string $description, array $metadata = []): ?static
    {
        $this->increment('total_points', $points);
        $this->increment('lifetime_points', $points);
        $this->increment('monthly_points', $points);
        $this->increment('weekly_points', $points);

        // Check for level up
        $this->checkLevelUp();

        // Update streak
        $this->updateStreak();

        // Create transaction
        PointTransaction::create([
            'candidate_id' => $this->candidate_id,
            'action' => $action,
            'points' => $points,
            'description' => $description,
            'metadata' => $metadata,
        ]);

        return $this->fresh();
    }

    /**
     * Check and handle level up
     */
    protected function checkLevelUp(): void
    {
        while ($this->total_points >= $this->points_to_next_level) {
            $this->increment('current_level');

            // Calculate next level requirement (progressive)
            $nextLevelPoints = $this->calculateNextLevelPoints($this->current_level);
            $this->update(['points_to_next_level' => $nextLevelPoints]);
        }
    }

    /**
     * Calculate points needed for next level
     */
    protected function calculateNextLevelPoints(int $level): int
    {
        // Progressive difficulty: base * level^1.5
        return (int) (100 * pow($level + 1, 1.5));
    }

    /**
     * Update activity streak
     *
     * @return void
     */
    protected function updateStreak()
    {
        $today = now()->toDateString();
        $lastActivity = $this->last_activity_date?->toDateString();

        if ($lastActivity === $today) {
            // Already counted today
            return;
        }

        if ($lastActivity === now()->subDay()->toDateString()) {
            // Consecutive day
            $this->increment('streak_days');
        } elseif ($lastActivity) {
            // Streak broken
            $this->update(['streak_days' => 1]);
        } else {
            // First activity
            $this->update(['streak_days' => 1]);
        }

        $this->update(['last_activity_date' => $today]);
    }

    /**
     * Reset monthly points
     */
    public function resetMonthlyPoints(): void
    {
        $this->update([
            'monthly_points' => 0,
            'last_monthly_reset' => now()->toDateString(),
        ]);
    }

    /**
     * Reset weekly points
     */
    public function resetWeeklyPoints(): void
    {
        $this->update([
            'weekly_points' => 0,
            'last_weekly_reset' => now()->toDateString(),
        ]);
    }

    /**
     * Get progress to next level percentage
     */
    public function getProgressToNextLevelAttribute(): float
    {
        $previousThreshold = $this->current_level > 1
            ? $this->calculateNextLevelPoints($this->current_level - 1)
            : 0;

        $currentThreshold = max($this->points_to_next_level, $previousThreshold + 1);
        $pointsInCurrentLevel = max(0, $this->total_points - $previousThreshold);
        $pointsNeededForLevel = max(1, $currentThreshold - $previousThreshold);

        $progress = $pointsInCurrentLevel / $pointsNeededForLevel;

        return round(min($progress, 1) * 100, 2);
    }

    /**
     * Get level badge color
     */
    public function getLevelColorAttribute(): string
    {
        if ($this->current_level >= 50) {
            return '#FFD700'; // Gold
        } elseif ($this->current_level >= 30) {
            return '#A855F7'; // Purple
        } elseif ($this->current_level >= 15) {
            return '#3B82F6'; // Blue
        } elseif ($this->current_level >= 5) {
            return '#10B981'; // Green
        }

        return '#6B7280'; // Gray
    }

    /**
     * Get level title
     */
    public function getLevelTitleAttribute(): string
    {
        if ($this->current_level >= 50) {
            return 'Legend';
        } elseif ($this->current_level >= 30) {
            return 'Master';
        } elseif ($this->current_level >= 15) {
            return 'Expert';
        } elseif ($this->current_level >= 5) {
            return 'Intermediate';
        }

        return 'Beginner';
    }
}
