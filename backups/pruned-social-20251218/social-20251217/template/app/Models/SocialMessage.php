<?php

namespace App\Models;

use App\Enums\SocialMessageStatus;
use App\Enums\SocialMessageType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $social_thread_id
 * @property int $sender_social_profile_id
 * @property SocialMessageType $message_type
 * @property SocialMessageStatus $status
 * @property string|null $body
 * @property array<array-key, mixed>|null $structured_body
 * @property string|null $shareable_type
 * @property int|null $shareable_id
 * @property int|null $reply_to_message_id
 * @property int|null $template_id
 * @property bool $is_system
 * @property \Illuminate\Support\Carbon|null $sent_at
 * @property \Illuminate\Support\Carbon|null $edited_at
 * @property float $spam_score
 * @property array<array-key, mixed>|null $moderation_flags
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialMessageAttachment> $attachments
 * @property int|null attachments_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialMessageReaction> $reactions
 * @property int|null reactions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialMessageRead> $reads
 * @property int|null reads_count
 * @property-read SocialMessage|null $replyTo
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialMessageReport> $reports
 * @property int|null reports_count
 * @property-read \App\Models\SocialProfile $sender
 * @property-read Model|\Eloquent|null $shareable
 * @property-read \App\Models\SocialThread $thread
 * @method static \Database\Factories\SocialMessageFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereBody($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereEditedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereIsSystem($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereMessageType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereModerationFlags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereReplyToMessageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereSenderSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereSentAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereShareableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereShareableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereSocialThreadId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereSpamScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereStructuredBody($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereTemplateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessage withoutTrashed()
 * @mixin \Eloquent
 */
final class SocialMessage extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'social_thread_id',
        'sender_social_profile_id',
        'message_type',
        'status',
        'body',
        'structured_body',
        'shareable_type',
        'shareable_id',
        'reply_to_message_id',
        'template_id',
        'is_system',
        'sent_at',
        'edited_at',
        'deleted_at',
        'spam_score',
        'moderation_flags',
    ];

    protected $casts = [
        'message_type' => SocialMessageType::class,
        'status' => SocialMessageStatus::class,
        'structured_body' => 'array',
        'is_system' => 'boolean',
        'sent_at' => 'datetime',
        'edited_at' => 'datetime',
        'deleted_at' => 'datetime',
        'spam_score' => 'float',
        'moderation_flags' => 'array',
    ];

    protected $touches = ['thread'];

    public function thread(): BelongsTo
    {
        return $this->belongsTo(SocialThread::class, 'social_thread_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'sender_social_profile_id');
    }

    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reply_to_message_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(SocialMessageAttachment::class);
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(SocialMessageReaction::class, 'social_message_id');
    }

    public function reads(): HasMany
    {
        return $this->hasMany(SocialMessageRead::class);
    }

    public function shareable(): MorphTo
    {
        return $this->morphTo();
    }

    public function reports(): HasMany
    {
        return $this->hasMany(SocialMessageReport::class, 'social_message_id');
    }
}

