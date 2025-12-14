<?php

namespace App\Models\Pathways;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string $source_type
 * @property int $source_id
 * @property string $target_type
 * @property int $target_id
 * @property int $connection_score
 * @property int|null $estimated_duration_weeks
 * @property string|null $estimated_cost_aud
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read Model|\Eloquent $source
 * @property-read Model|\Eloquent $target
 * @property-read User|null $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection ofType(string $type)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection whereConnectionScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection whereEstimatedCostAud($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection whereEstimatedDurationWeeks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection whereSourceId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection whereSourceType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection whereTargetId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection whereTargetType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayConnection whereUserId($value)
 * @mixin \Eloquent
 */
final class PathwayConnection extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'source_type',
        'source_id',
        'target_type',
        'target_id',
        'connection_score',
        'estimated_duration_weeks',
        'estimated_cost_aud',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function source(): MorphTo
    {
        return $this->morphTo(__FUNCTION__, 'source_type', 'source_id');
    }

    public function target(): MorphTo
    {
        return $this->morphTo(__FUNCTION__, 'target_type', 'target_id');
    }

    public function scopeOfType($query, string $type)
    {
        return $query->where('source_type', $type);
    }

    public function calculateComplexityScore(): int
    {
        $duration = (int) $this->estimated_duration_weeks;
        $cost = (float) $this->estimated_cost_aud;

        $durationScore = $duration > 0 ? min(60, $duration / 104 * 60) : 0;
        $costScore = $cost > 0 ? min(40, $cost / 50000 * 40) : 0;

        return (int) round($durationScore + $costScore);
    }
}

