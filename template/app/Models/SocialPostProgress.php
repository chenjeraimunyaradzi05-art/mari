<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property int $social_post_id
 * @property int $progress_seconds
 * @property int|null $total_duration_seconds
 * @property bool $is_completed
 * @property \Illuminate\Support\Carbon $last_watched_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialPost $post
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostProgress newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostProgress newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostProgress query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostProgress whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostProgress whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostProgress whereIsCompleted($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostProgress whereLastWatchedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostProgress whereProgressSeconds($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostProgress whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostProgress whereTotalDurationSeconds($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostProgress whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostProgress whereUserId($value)
 * @mixin \Eloquent
 */
final class SocialPostProgress extends Model
{
    use HasFactory;

    protected $table = 'social_post_progress';

    protected $fillable = [
        'user_id',
        'social_post_id',
        'progress_seconds',
        'total_duration_seconds',
        'is_completed',
        'last_watched_at',
    ];

    protected $casts = [
        'is_completed' => 'boolean',
        'last_watched_at' => 'datetime',
        'progress_seconds' => 'integer',
        'total_duration_seconds' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }
}

