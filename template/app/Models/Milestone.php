<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string $description
 * @property string $category
 * @property int $threshold
 * @property int $points_reward
 * @property int|null $badge_id
 * @property string $icon
 * @property string $color
 * @property bool $is_active
 * @property int $achieved_count
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Badge|null $badge
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CandidateMilestone> $candidateMilestones
 * @property int|null candidate_milestones_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone ofCategory($category)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone whereAchievedCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone whereBadgeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone whereColor($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone whereIcon($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone wherePointsReward($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone whereThreshold($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Milestone whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class Milestone extends Model
{
    protected $fillable = [
        'name',
        'description',
        'category',
        'threshold',
        'points_reward',
        'badge_id',
        'icon',
        'color',
        'is_active',
        'achieved_count',
    ];

    protected $casts = [
        'threshold' => 'integer',
        'points_reward' => 'integer',
        'is_active' => 'boolean',
        'achieved_count' => 'integer',
    ];

    /**
     * Get the badge reward
     */
    public function badge(): BelongsTo
    {
        return $this->belongsTo(Badge::class);
    }

    /**
     * Get candidate achievements
     */
    public function candidateMilestones(): HasMany
    {
        return $this->hasMany(CandidateMilestone::class);
    }

    /**
     * Scope for active
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope by category
     */
    public function scopeOfCategory($query, $category)
    {
        return $query->where('category', $category);
    }
}
