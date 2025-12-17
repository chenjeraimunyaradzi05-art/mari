<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $social_post_id
 * @property int|null $user_id
 * @property string $source
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon $viewed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialPost $post
 * @property-read \App\Models\User|null $user
 * @method static \Database\Factories\SocialPostImpressionFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostImpression newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostImpression newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostImpression query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostImpression whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostImpression whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostImpression whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostImpression whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostImpression whereSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostImpression whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostImpression whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostImpression whereViewedAt($value)
 * @mixin \Eloquent
 */
final class SocialPostImpression extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_post_id',
        'user_id',
        'source',
        'meta',
        'viewed_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'viewed_at' => 'datetime',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

