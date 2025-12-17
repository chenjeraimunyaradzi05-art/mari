<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $social_message_id
 * @property int $social_thread_participant_id
 * @property \Illuminate\Support\Carbon|null $delivered_at
 * @property \Illuminate\Support\Carbon|null $read_at
 * @property string|null $device
 * @property array<array-key, mixed>|null $context
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialMessage $message
 * @property-read \App\Models\SocialThreadParticipant $participant
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRead newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRead newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRead query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRead whereContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRead whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRead whereDeliveredAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRead whereDevice($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRead whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRead whereReadAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRead whereSocialMessageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRead whereSocialThreadParticipantId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRead whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialMessageRead extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_message_id',
        'social_thread_participant_id',
        'delivered_at',
        'read_at',
        'device',
        'context',
    ];

    protected $casts = [
        'delivered_at' => 'datetime',
        'read_at' => 'datetime',
        'context' => 'array',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(SocialMessage::class, 'social_message_id');
    }

    public function participant(): BelongsTo
    {
        return $this->belongsTo(SocialThreadParticipant::class, 'social_thread_participant_id');
    }
}

