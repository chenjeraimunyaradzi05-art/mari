<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $candidate_id
 * @property string $action
 * @property int $points
 * @property string $description
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Candidate $candidate
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PointTransaction newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PointTransaction newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PointTransaction ofAction($action)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PointTransaction query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PointTransaction recent($days = 7)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PointTransaction whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PointTransaction whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PointTransaction whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PointTransaction whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PointTransaction whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PointTransaction whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PointTransaction wherePoints($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PointTransaction whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class PointTransaction extends Model
{
    protected $fillable = [
        'candidate_id',
        'action',
        'points',
        'description',
        'metadata',
    ];

    protected $casts = [
        'points' => 'integer',
        'metadata' => 'array',
    ];

    /**
     * Get the candidate
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    /**
     * Scope for recent transactions
     */
    public function scopeRecent($query, $days = 7)
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }

    /**
     * Scope by action type
     */
    public function scopeOfAction($query, $action)
    {
        return $query->where('action', $action);
    }
}
