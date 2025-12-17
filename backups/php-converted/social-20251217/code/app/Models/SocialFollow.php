<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $follower_id
 * @property int $following_id
 * @property bool $is_close_friend
 * @property bool $notifications_enabled
 * @property \Illuminate\Support\Carbon $followed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialProfile $follower
 * @property-read \App\Models\SocialProfile $following
 * @method static \Database\Factories\SocialFollowFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialFollow newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialFollow newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialFollow query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialFollow whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialFollow whereFollowedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialFollow whereFollowerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialFollow whereFollowingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialFollow whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialFollow whereIsCloseFriend($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialFollow whereNotificationsEnabled($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialFollow whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialFollow extends Model
{
    use HasFactory;

    protected $table = 'social_follows';

    protected $fillable = [
        'follower_id',
        'following_id',
        'is_close_friend',
        'notifications_enabled',
        'followed_at',
    ];

    protected $casts = [
        'is_close_friend' => 'boolean',
        'notifications_enabled' => 'boolean',
        'followed_at' => 'datetime',
    ];

    public function follower(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'follower_id');
    }

    public function following(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'following_id');
    }
}

