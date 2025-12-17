<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $social_message_id
 * @property int $social_profile_id
 * @property string $emoji
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialMessage $message
 * @property-read \App\Models\SocialProfile $profile
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReaction newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReaction newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReaction query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReaction whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReaction whereEmoji($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReaction whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReaction whereSocialMessageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|final SocialMessageReaction whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReaction whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialMessageReaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_message_id',
        'social_profile_id',
        'emoji',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(SocialMessage::class, 'social_message_id');
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }
}
