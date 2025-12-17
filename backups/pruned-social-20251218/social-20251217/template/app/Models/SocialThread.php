<?php

namespace App\Models;

use App\Enums\SocialThreadParticipantStatus;
use App\Enums\SocialThreadRequestMode;
use App\Enums\SocialThreadStatus;
use App\Enums\SocialThreadType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $created_by_social_profile_id
 * @property SocialThreadType $thread_type
 * @property SocialThreadStatus $status
 * @property SocialThreadRequestMode $message_request_mode
 * @property string|null $subject
 * @property bool $is_system
 * @property float $spam_score
 * @property array<array-key, mixed>|null $metadata
 * @property int|null $last_message_id
 * @property \Illuminate\Support\Carbon|null $last_message_at
 * @property \Illuminate\Support\Carbon|null $muted_by_system_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialThreadBinding> $bindings
 * @property int|null bindings_count
 * @property-read \App\Models\SocialProfile $creator
 * @property-read \App\Models\SocialMessage|null $lastMessage
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialMessage> $messages
 * @property int|null messages_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialThreadParticipant> $participants
 * @property int|null participants_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialMessageRequest> $requests
 * @property int|null requests_count
 * @method static \Database\Factories\SocialThreadFactory factory($count = null, $state = [])
 * @method static Builder<static>|SocialThread forProfile(\App\Models\SocialProfile $profile)
 * @method static Builder<static>|SocialThread newModelQuery()
 * @method static Builder<static>|SocialThread newQuery()
 * @method static Builder<static>|SocialThread onlyTrashed()
 * @method static Builder<static>|SocialThread query()
 * @method static Builder<static>|SocialThread whereCreatedAt($value)
 * @method static Builder<static>|SocialThread whereCreatedBySocialProfileId($value)
 * @method static Builder<static>|SocialThread whereDeletedAt($value)
 * @method static Builder<static>|SocialThread whereId($value)
 * @method static Builder<static>|SocialThread whereIsSystem($value)
 * @method static Builder<static>|SocialThread whereLastMessageAt($value)
 * @method static Builder<static>|SocialThread whereLastMessageId($value)
 * @method static Builder<static>|SocialThread whereMessageRequestMode($value)
 * @method static Builder<static>|SocialThread whereMetadata($value)
 * @method static Builder<static>|SocialThread whereMutedBySystemAt($value)
 * @method static Builder<static>|SocialThread whereSpamScore($value)
 * @method static Builder<static>|SocialThread whereStatus($value)
 * @method static Builder<static>|SocialThread whereSubject($value)
 * @method static Builder<static>|SocialThread whereThreadType($value)
 * @method static Builder<static>|SocialThread whereUpdatedAt($value)
 * @method static Builder<static>|SocialThread withTrashed(bool $withTrashed = true)
 * @method static Builder<static>|SocialThread withoutTrashed()
 * @mixin \Eloquent
 */
final class SocialThread extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'created_by_social_profile_id',
        'thread_type',
        'status',
        'message_request_mode',
        'subject',
        'is_system',
        'spam_score',
        'metadata',
        'last_message_id',
        'last_message_at',
        'muted_by_system_at',
    ];

    protected $casts = [
        'thread_type' => SocialThreadType::class,
        'status' => SocialThreadStatus::class,
        'message_request_mode' => SocialThreadRequestMode::class,
        'is_system' => 'boolean',
        'spam_score' => 'float',
        'metadata' => 'array',
        'last_message_at' => 'datetime',
        'muted_by_system_at' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'created_by_social_profile_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(SocialThreadParticipant::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SocialMessage::class);
    }

    public function bindings(): HasMany
    {
        return $this->hasMany(SocialThreadBinding::class);
    }

    public function lastMessage(): BelongsTo
    {
        return $this->belongsTo(SocialMessage::class, 'last_message_id');
    }

    public function requests(): HasMany
    {
        return $this->hasMany(SocialMessageRequest::class);
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeForProfile(Builder $query, SocialProfile $profile): Builder
    {
        return $query->whereHas('participants', fn (Builder $builder) => $builder->where('social_profile_id', $profile->getKey()));
    }

    public function activateIfReady(): void
    {
        if ($this->status === SocialThreadStatus::Active) {
            return;
        }

        $blockedStatuses = [
            SocialThreadParticipantStatus::Pending->value,
            SocialThreadParticipantStatus::Blocked->value,
            SocialThreadParticipantStatus::Removed->value,
        ];

        if ($this->participants()->whereIn('status', $blockedStatuses)->exists()) {
            return;
        }

        $this->forceFill(['status' => SocialThreadStatus::Active])->save();
    }
}

