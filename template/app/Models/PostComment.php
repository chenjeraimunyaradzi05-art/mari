<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $post_id
 * @property int $user_id
 * @property string $content
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property string|null $deleted_at
 * @property-read \App\Models\Post $post
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostComment newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostComment newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostComment query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostComment whereContent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostComment whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostComment whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostComment whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostComment wherePostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostComment whereUpdatedAt(final $value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PostComment whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class PostComment extends Model
{
    protected $fillable = [
        'post_id',
        'user_id',
        'content',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the post that this comment belongs to.
     */
    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /**
     * Get the user that created this comment.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
