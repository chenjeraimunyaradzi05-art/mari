<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $social_post_id
 * @property int $social_profile_id
 * @property int|null $parent_id
 * @property string $content
 * @property array<array-key, mixed>|null $mentions
 * @property int|null $likes_count
 * @property int|null $replies_count
 * @property bool $is_pinned
 * @property array<array-key, mixed>|null $ai_sentiment
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property mixed $comment
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialLike> $likes
 * @property-read SocialComment|null $parent
 * @property-read \App\Models\SocialPost $post
 * @property-read \App\Models\SocialProfile $profile
 * @property-read \Illuminate\Database\Eloquent\Collection<int, SocialComment> $replies
 * @property-read \App\Models\User|null $user
 * @method static \Database\Factories\SocialCommentFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment whereAiSentiment($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment whereContent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment whereIsPinned($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment whereLikesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment whereMentions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment whereParentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment whereRepliesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialComment withoutTrashed()
 * @mixin \Eloquent
 */
class SocialComment extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'social_post_id',
        'social_profile_id',
        'user_id',
        'parent_id',
        'content',
        'mentions',
        'likes_count',
        'replies_count',
        'is_pinned',
        'ai_sentiment',
        'meta',
    ];

    protected $casts = [
        'mentions' => 'array',
        'ai_sentiment' => 'array',
        'meta' => 'array',
        'likes_count' => 'integer',
        'replies_count' => 'integer',
        'is_pinned' => 'boolean',
    ];

    protected function comment(): Attribute
    {
        return Attribute::make(
            get: fn ($value, array $attributes) => $attributes['content'] ?? $value,
            set: fn ($value) => ['content' => $value],
        );
    }

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

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function likes(): MorphMany
    {
        return $this->morphMany(SocialLike::class, 'likeable');
    }
}
