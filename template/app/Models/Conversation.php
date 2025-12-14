<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $id
 * @property string $type
 * @property int $created_by_profile_id
 * @property string|null $subject
 * @property bool $requires_approval
 * @property string $status
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $last_message_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Profile $creator
 * @property-read \App\Models\ConversationMessage|null $latestMessage
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ConversationMessage> $messages
 * @property int|null messages_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ConversationParticipant> $participants
 * @property int|null participants_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation forProfile(\App\Models\Profile $profile)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation whereCreatedByProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation whereLastMessageAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation whereRequiresApproval($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation whereSubject($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Conversation whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class Conversation extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'created_by_profile_id',
        'subject',
        'requires_approval',
        'status',
        'metadata',
        'last_message_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'requires_approval' => 'boolean',
        'last_message_at' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'created_by_profile_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ConversationMessage::class);
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(ConversationMessage::class)->latestOfMany('sent_at');
    }

    public function scopeForProfile($query, Profile $profile)
    {
        return $query->whereHas('participants', fn ($q) => $q->where('profile_id', $profile->id));
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function activateIfReady(): void
    {
        if ($this->participants()->whereIn('status', ['pending', 'blocked'])->exists()) {
            return;
        }

        if ($this->status !== 'active') {
            $this->forceFill(['status' => 'active'])->save();
        }
    }
}
