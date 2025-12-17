<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $post_id
 * @property int $user_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Post $post
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostLike newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostLike newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostLike query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostLike whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostLike whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostLike wherePostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostLike whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostLike whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class PostLike extends Model
{
    protected $fillable = [
        'post_id',
        'user_id',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the post that this like belongs to.
     */
    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /**
     * Get the user that liked this post.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
