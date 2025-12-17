<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $social_post_id
 * @property int|null $social_profile_id
 * @property int|null $user_id
 * @property string $channel
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon $shared_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialPost $post
 * @property-read \App\Models\SocialProfile|null $profile
 * @property-read \App\Models\User|null $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostShare newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostShare newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostShare query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostShare whereChannel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostShare whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostShare whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostShare whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostShare whereSharedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostShare whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostShare whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostShare whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostShare whereUserId($value)
 * @mixin \Eloquent
 */
final class SocialPostShare extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_post_id',
        'social_profile_id',
        'user_id',
        'channel',
        'meta',
        'shared_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'shared_at' => 'datetime',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

