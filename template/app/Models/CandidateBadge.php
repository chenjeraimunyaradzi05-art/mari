<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $candidate_id
 * @property int $badge_id
 * @property \Illuminate\Support\Carbon $earned_at
 * @property int $progress_percentage
 * @property array<array-key, mixed>|null $progress_data
 * @property bool $is_showcased
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Badge $badge
 * @property-read \App\Models\Candidate $candidate
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge recentlyEarned($days = 7)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge showcased()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge whereBadgeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge whereEarnedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge whereIsShowcased($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge whereProgressData($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge whereProgressPercentage($valuefinal )
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateBadge whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CandidateBadge extends Model
{
    protected $fillable = [
        'candidate_id',
        'badge_id',
        'earned_at',
        'progress_percentage',
        'progress_data',
        'is_showcased',
    ];

    protected $casts = [
        'earned_at' => 'datetime',
        'progress_percentage' => 'integer',
        'progress_data' => 'array',
        'is_showcased' => 'boolean',
    ];

    /**
     * Get the candidate
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    /**
     * Get the badge
     */
    public function badge(): BelongsTo
    {
        return $this->belongsTo(Badge::class);
    }

    /**
     * Scope for showcased badges
     */
    public function scopeShowcased($query)
    {
        return $query->where('is_showcased', true);
    }

    /**
     * Scope for recently earned
     */
    public function scopeRecentlyEarned($query, $days = 7)
    {
        return $query->where('earned_at', '>=', now()->subDays($days));
    }
}
