<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $candidate_id
 * @property int $milestone_id
 * @property \Illuminate\Support\Carbon $achieved_at
 * @property int $value_at_achievement
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Candidate $candidate
 * @property-read \App\Models\Milestone $milestone
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateMilestone newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateMilestone newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateMilestone query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateMilestone recentlyAchieved($days = 7)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateMilestone whereAchievedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateMilestone whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateMilestone whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateMilestone whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateMilestone whereMilestoneId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateMilestone whereUpdatedAt($value)
 *
 * @methodstatic \Illuminate\Database\Eloquent\Builder<static>|CandidateMilestone whereValueAtAchievement($value)
 *
 * @mixin \Eloquent
 */
final class CandidateMilestone extends Model
{
    protected $fillable = [
        'candidate_id',
        'milestone_id',
        'achieved_at',
        'value_at_achievement',
    ];

    protected $casts = [
        'achieved_at' => 'datetime',
        'value_at_achievement' => 'integer',
    ];

    /**
     * Get the candidate
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    /**
     * Get the milestone
     */
    public function milestone(): BelongsTo
    {
        return $this->belongsTo(Milestone::class);
    }

    /**
     * Scope for recently achieved
     */
    public function scopeRecentlyAchieved($query, $days = 7)
    {
        return $query->where('achieved_at', '>=', now()->subDays($days));
    }
}
