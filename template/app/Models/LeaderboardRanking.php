<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property string $leaderboard_type
 * @property int $candidate_id
 * @property int $rank
 * @property int $points
 * @property int|null $level
 * @property int|null $badges_count
 * @property int|null $challenges_completed
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $period_start
 * @property \Illuminate\Support\Carbon|null $period_end
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Candidate $candidate
 * @property-read string $rank_badge
 * @property-read string $rank_color
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking currentPeriod()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking ofType($type)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking top10($type = 'all_time')
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking whereBadgesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking whereChallengesCompleted($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking whereLeaderboardType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking whereLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking wherePeriodEnd($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking wherePeriodStart($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking wherePoints($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking whereRank($value)
 final  * @method static \Illuminate\Database\Eloquent\Builder<static>|LeaderboardRanking whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class LeaderboardRanking extends Model
{
    protected $fillable = [
        'leaderboard_type',
        'candidate_id',
        'rank',
        'points',
        'level',
        'badges_count',
        'challenges_completed',
        'metadata',
        'period_start',
        'period_end',
    ];

    protected $casts = [
        'rank' => 'integer',
        'points' => 'integer',
        'level' => 'integer',
        'badges_count' => 'integer',
        'challenges_completed' => 'integer',
        'metadata' => 'array',
        'period_start' => 'date',
        'period_end' => 'date',
    ];

    /**
     * Get the candidate
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    /**
     * Get rank badge
     */
    public function getRankBadgeAttribute(): string
    {
        if ($this->rank === 1) {
            return '🥇 1st';
        } elseif ($this->rank === 2) {
            return '🥈 2nd';
        } elseif ($this->rank === 3) {
            return '🥉 3rd';
        }

        return "#{$this->rank}";
    }

    /**
     * Get rank color
     */
    public function getRankColorAttribute(): string
    {
        if ($this->rank === 1) {
            return '#FFD700'; // Gold
        } elseif ($this->rank === 2) {
            return '#C0C0C0'; // Silver
        } elseif ($this->rank === 3) {
            return '#CD7F32'; // Bronze
        }

        return '#6B7280'; // Gray
    }

    /**
     * Scope for top 10
     */
    public function scopeTop10($query, $type = 'all_time')
    {
        return $query->where('leaderboard_type', $type)
            ->orderBy('rank')
            ->take(10);
    }

    /**
     * Scope by type
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('leaderboard_type', $type);
    }

    /**
     * Scope for current period
     */
    public function scopeCurrentPeriod($query)
    {
        $today = now()->toDateString();

        return $query->whereDate('period_start', '<=', $today)
            ->whereDate('period_end', '>=', $today);
    }
}
