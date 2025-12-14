<?php

namespace App\Models;

use Carbon\Carbon;
use DateTime;
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
 * @property-read string $level_name
 * @property-read float $progress_to_next_level
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PointTransaction> $transactions
 * @property int|null transactions_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints whereCurrentLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints whereLastActivityDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints whereLastMonthlyReset($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints whereLastWeeklyReset($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints whereLifetimePoints($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints whereMonthlyPoints($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints wherePointsToNextLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints whereStreakDays($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints whereTotalPoints($value)
 * @method static\\Illuminate\Database\Eloquent\Builder<static>|CandidatePoints whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidatePoints whereWeeklyPoints($value)
 *
 * @mixin \Eloquent
 */
final class CandidatePoints extends Model
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
     * Get transaction history
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(PointTransaction::class, 'candidate_id', 'candidate_id');
    }

    /**
     * Get level color
     */
    public function getLevelColorAttribute(): string
    {
        if ($this->current_level >= 50) {
            return '#8B5CF6'; // Purple - Legend
        } elseif ($this->current_level >= 30) {
            return '#E91E8C'; // Pink - Master
        } elseif ($this->current_level >= 15) {
            return '#F59E0B'; // Orange - Expert
        } elseif ($this->current_level >= 5) {
            return '#3B82F6'; // Blue - Advanced
        }

        return '#10B981'; // Green - Beginner
    }

    /**
     * Get level name
     */
    public function getLevelNameAttribute(): string
    {
        if ($this->current_level >= 50) {
            return 'Legend';
        } elseif ($this->current_level >= 30) {
            return 'Master';
        } elseif ($this->current_level >= 15) {
            return 'Expert';
        } elseif ($this->current_level >= 5) {
            return 'Advanced';
        }

        return 'Novice';
    }

    /**
     * Get progress percentage to next level
     */
    public function getProgressToNextLevelAttribute(): float
    {
        if ($this->points_to_next_level <= 0) {
            return 100;
        }

        $pointsForLevel = $this->current_level * 100;
        $pointsEarned = $this->total_points - ($this->current_level - 1) * $pointsForLevel;

        return round(($pointsEarned / $pointsForLevel) * 100, 2);
    }

    /**
     * Add points
     */
    public function addPoints(int $points, string $action, string $description, array $metadata = []): void
    {
        $this->increment('total_points', $points);
        $this->increment('lifetime_points', $points);
        $this->increment('monthly_points', $points);
        $this->increment('weekly_points', $points);
        $this->update(['last_activity_date' => now()->toDateString()]);

        // Record transaction
        PointTransaction::create([
            'candidate_id' => $this->candidate_id,
            'action' => $action,
            'points' => $points,
            'description' => $description,
            'metadata' => $metadata,
        ]);

        // Check for level up
        $this->checkLevelUp();
    }

    /**
     * Check and apply level up
     */
    protected function checkLevelUp(): void
    {
        $requiredPoints = $this->current_level * 100;

        while ($this->total_points >= $requiredPoints) {
            $this->increment('current_level');
            $requiredPoints = $this->current_level * 100;
        }

        $this->update(['points_to_next_level' => max(0, $requiredPoints - $this->total_points)]);
    }

    /**
     * Update streak
     */
    public function updateStreak(): void
    {
        $lastActivity = $this->last_activity_date;

        if (! $lastActivity) {
            $this->update([
                'streak_days' => 1,
                'last_activity_date' => now()->toDateString(),
            ]);

            return;
        }

        $lastActivityDate = $lastActivity instanceof DateTime ? Carbon::instance($lastActivity) : Carbon::parse($lastActivity->toDateString());
        $today = now()->toDateString();

        if ($lastActivityDate->toDateString() === $today) {
            return; // Already active today
        }

        if ($lastActivityDate->addDay()->toDateString() === $today) {
            // Consecutive day
            $this->increment('streak_days');
            $this->update(['last_activity_date' => $today]);
        } else {
            // Streak broken
            $this->update([
                'streak_days' => 1,
                'last_activity_date' => $today,
            ]);
        }
    }

    /**
     * Reset monthly points if needed
     */
    public function resetMonthlyIfNeeded(): void
    {
        $lastReset = $this->last_monthly_reset;

        if (! $lastReset) {
            $this->update([
                'monthly_points' => 0,
                'last_monthly_reset' => now()->toDateString(),
            ]);

            return;
        }

        $resetDate = $lastReset instanceof DateTime ? Carbon::instance($lastReset) : Carbon::parse($lastReset->toDateString());

        if ($resetDate->month !== now()->month) {
            $this->update([
                'monthly_points' => 0,
                'last_monthly_reset' => now()->toDateString(),
            ]);
        }
    }

    /**
     * Reset weekly points if needed
     */
    public function resetWeeklyIfNeeded(): void
    {
        $lastReset = $this->last_weekly_reset;

        if (! $lastReset) {
            $this->update([
                'weekly_points' => 0,
                'last_weekly_reset' => now()->toDateString(),
            ]);

            return;
        }

        $resetDate = $lastReset instanceof DateTime ? Carbon::instance($lastReset) : Carbon::parse($lastReset->toDateString());

        if ($resetDate->addWeek()->isPast()) {
            $this->update([
                'weekly_points' => 0,
                'last_weekly_reset' => now()->toDateString(),
            ]);
        }
    }
}
