<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property int $social_profile_id
 * @property int|null $user_id
 * @property int|null $social_post_id
 * @property string $likeable_type
 * @property int $likeable_id
 * @property \Illuminate\Support\Carbon $liked_at
 * @property string $reaction
 * @property-read Model|\Eloquent $likeable
 * @property bool $wasRecentlyCreated
 * @property-read \App\Models\SocialPost|null $post
 * @property-read \App\Models\SocialProfile $profile
 * @property-read \App\Models\User|null $user
 * @method static \Database\Factories\SocialLikeFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLike newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLike newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLike query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLike whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLike whereLikeableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLike whereLikeableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLike whereLikedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLike whereReaction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLike whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLike whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLike whereUserId($value)
 * @mixin \Eloquent
 */
class SocialLike extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'social_profile_id',
        'user_id',
        'social_post_id',
        'likeable_type',
        'likeable_id',
        'reaction',
        'liked_at',
    ];

    protected $casts = [
        'liked_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }

    public function likeable(): MorphTo
    {
        return $this->morphTo();
    }
}
