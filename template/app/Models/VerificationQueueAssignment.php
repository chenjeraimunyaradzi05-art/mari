<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $verification_id
 * @property int $assigned_reviewer_id
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $assigned_at
 * @property \Illuminate\Support\Carbon|null $released_at
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Admin $reviewer
 * @property-read \App\Models\ProfileVerification $verification
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationQueueAssignment newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationQueueAssignment newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationQueueAssignment query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationQueueAssignment whereAssignedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationQueueAssignment whereAssignedReviewerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationQueueAssignment whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationQueueAssignment whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationQueueAssignment whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationQueueAssignment whereReleasedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationQueueAssignment whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationQueueAssignment whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationQueueAssignment whereVerificationId($value)
 * @mixin \Eloquent
 */
final class VerificationQueueAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'verification_id',
        'assigned_reviewer_id',
        'status',
        'assigned_at',
        'released_at',
        'metadata',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
        'released_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function verification(): BelongsTo
    {
        return $this->belongsTo(ProfileVerification::class, 'verification_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'assigned_reviewer_id');
    }
}

