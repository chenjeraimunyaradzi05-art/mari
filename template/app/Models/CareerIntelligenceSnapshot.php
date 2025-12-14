<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property float|null $trajectory_score
 * @property int|null $learning_hours
 * @property int|null $network_reach
 * @property float|null $content_influence
 * @property string|null $target_role
 * @property string|null $summary
 * @property \Illuminate\Support\Carbon $captured_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static Builder<static>|CareerIntelligenceSnapshot forUser(int $userId)
 * @method static Builder<static>|CareerIntelligenceSnapshot latestSnapshot()
 * @method static Builder<static>|CareerIntelligenceSnapshot newModelQuery()
 * @method static Builder<static>|CareerIntelligenceSnapshot newQuery()
 * @method static Builder<static>|CareerIntelligenceSnapshot query()
 * @method static Builder<static>|CareerIntelligenceSnapshot whereCapturedAt($value)
 * @method static Builder<static>|CareerIntelligenceSnapshot whereContentInfluence($value)
 * @method static Builder<static>|CareerIntelligenceSnapshot whereCreatedAt($value)
 * @method static Builder<static>|CareerIntelligenceSnapshot whereId($value)
 * @method static Builder<static>|CareerIntelligenceSnapshot whereLearningHours($value)
 * @method static Builder<static>|CareerIntelligenceSnapshot whereNetworkReach($value)
 * @method static Builder<static>|CareerIntelligenceSnapshot whereSummary($value)
 * @method static Builder<static>|CareerIntelligenceSnapshot whereTargetRole($value)
 * @method static Builder<static>|CareerIntelligenceSnapshot whereTrajectoryScore($value)
 * @method static Builder<static>|CareerIntelligenceSnapshot whereUpdatedAt($value)
 * @method static Builder<static>|CareerIntelligenceSnapshot whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class CareerIntelligenceSnapshot extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'trajectory_score',
        'learning_hours',
        'network_reach',
        'content_influence',
        'target_role',
        'summary',
        'captured_at',
    ];

    protected $casts = [
        'trajectory_score' => 'float',
        'learning_hours' => 'integer',
        'network_reach' => 'integer',
        'content_influence' => 'float',
        'captured_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeLatestSnapshot(Builder $query): Builder
    {
        return $query->orderByDesc('captured_at')->orderByDesc('id');
    }
}
