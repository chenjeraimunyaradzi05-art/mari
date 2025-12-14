<?php

namespace App\Models;

use App\Enums\IdentityFlagStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $source
 * @property string $type
 * @property IdentityFlagStatus $status
 * @property string $severity
 * @property float $score
 * @property string|null $reason
 * @property array<array-key, mixed>|null $signals
 * @property array<array-key, mixed>|null $metadata
 * @property array<array-key, mixed>|null $actions_taken
 * @property \Illuminate\Support\Carbon|null $flagged_at
 * @property \Illuminate\Support\Carbon|null $resolved_at
 * @property string|null $resolution_notes
 * @property-read \App\Models\User $user
 * @property-read \App\Models\Admin|null $resolvedBy
 * @property int|null $resolved_by_admin_id
 * @property string|null $appeal_text
 * @property \Illuminate\Support\Carbon|null $appealed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereActionsTaken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereAppealText($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereAppealedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereFlaggedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereResolutionNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereResolvedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereResolvedByAdminId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereSeverity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereSignals($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IdentityFlag whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class IdentityFlag extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'source',
        'type',
        'status',
        'severity',
        'score',
        'reason',
        'signals',
        'metadata',
        'actions_taken',
        'flagged_at',
        'resolved_at',
        'resolved_by_admin_id',
        'resolution_notes',
        'appeal_text',
        'appealed_at',
    ];

    protected $casts = [
        'signals' => 'array',
        'metadata' => 'array',
        'actions_taken' => 'array',
        'flagged_at' => 'datetime',
        'resolved_at' => 'datetime',
        'appealed_at' => 'datetime',
        'status' => IdentityFlagStatus::class,
        'score' => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'resolved_by_admin_id');
    }
}
