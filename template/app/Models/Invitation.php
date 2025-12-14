<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $sender_id
 * @property int $receiver_id
 * @property string $type
 * @property string|null $message
 * @property string|null $template_key
 * @property array<array-key, mixed>|null $metadata
 * @property string $status
 * @property int|null $mentorship_cohort_id
 * @property int|null $mentorship_match_id
 * @property \Illuminate\Support\Carbon|null $nudges_scheduled_at
 * @property \Illuminate\Support\Carbon|null $last_nudged_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $receiver
 * @property-read \App\Models\User $sender
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation accepted()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation byType($type)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation pending()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation rejected()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereReceiverId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereSenderId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereUpdatedAt($value)
 *
 * @property-read \App\Models\MentorshipCohort|null $mentorshipCohort
 * @property-read \App\Models\MentorshipMatch|null $mentorshipMatch
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereLastNudgedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereMentorshipCohortId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereMentorshipMatchId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereNudgesScheduledAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invitation whereTemplateKey($value)
 *
 * @mixin \Eloquent
 */
final class Invitation extends Model
{
    protected $fillable = [
        'sender_id',
        'receiver_id',
        'type',
        'message',
        'status',
        'template_key',
        'metadata',
        'mentorship_cohort_id',
        'mentorship_match_id',
        'nudges_scheduled_at',
        'last_nudged_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'metadata' => 'array',
        'nudges_scheduled_at' => 'datetime',
        'last_nudged_at' => 'datetime',
    ];

    /**
     * Get the user who sent the invitation.
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /**
     * Get the user who received the invitation.
     */
    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }

    public function mentorshipCohort(): BelongsTo
    {
        return $this->belongsTo(MentorshipCohort::class, 'mentorship_cohort_id');
    }

    public function mentorshipMatch(): BelongsTo
    {
        return $this->belongsTo(MentorshipMatch::class, 'mentorship_match_id');
    }

    /**
     * Scope to get pending invitations.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope to get accepted invitations.
     */
    public function scopeAccepted($query)
    {
        return $query->where('status', 'accepted');
    }

    /**
     * Scope to get rejected invitations.
     */
    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }

    /**
     * Scope to get invitations by type.
     */
    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Check if invitation is pending.
     */
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /**
     * Check if invitation is accepted.
     */
    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }

    /**
     * Check if invitation is rejected.
     */
    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }
}
