<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property string $author_type
 * @property string $content
 * @property string|null $tags
 * @property string|null $media
 * @property string|null $type
 * @property string|null $audience_sector
 * @property array<array-key, mixed>|null $audience_skills
 * @property array<array-key, mixed>|null $metadata
 * @property array<array-key, mixed>|null $match_insights
 * @property string $visibility
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Candidate|null $candidate
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PostComment> $comments
 * @property int|null comments_count
 * @property-read array $audience_skill_list
 * @property int|null likes_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PostLike> $likes
 * @property-read \App\Models\User|null $user
 *
 * @method static \Database\Factories\PostFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post forCandidates()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post forCompanies()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post fromUser($userId)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post private()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post public()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereAudienceSector($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereAudienceSkills($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereAuthorType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereContent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereMatchInsights($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereMedia($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereVisibility($value)
 *
 * @property bool $is_flagged
 * @property string|null $flag_reasons
 * @property string $moderation_status
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereFlagReasons($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereIsFlagged($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Post whereModerationStatus($value)
 *
 * @mixin \Eloquent
 */
final class Post extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'content',
        'tags',
        'media',
        'type',
        'visibility',
        'author_type',
        'audience_sector',
        'audience_skills',
        'metadata',
        'match_insights',
        'is_flagged',
        'flag_reasons',
        'moderation_status',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'audience_skills' => 'array',
        'metadata' => 'array',
        'match_insights' => 'array',
        'is_flagged' => 'boolean',
    ];

    protected $appends = [
        'audience_skill_list',
    ];

    /**
     * Get the user that owns the post.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the candidate associated with this post through user.
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class, 'user_id', 'user_id');
    }

    /**
     * Get all comments on this post.
     */
    public function comments(): HasMany
    {
        return $this->hasMany(PostComment::class);
    }

    /**
     * Get all likes on this post.
     */
    public function likes(): HasMany
    {
        return $this->hasMany(PostLike::class);
    }

    /**
     * Scope to get public posts only.
     */
    public function scopePublic($query)
    {
        // Only show public posts that are not flagged or awaiting moderation
        return $query->where('visibility', 'public')
            ->where('is_flagged', false)
            ->where('moderation_status', 'approved');
    }

    /**
     * Scope to get private posts only.
     */
    public function scopePrivate($query)
    {
        return $query->where('visibility', 'private');
    }

    /**
     * Scope to get posts from a specific user.
     */
    public function scopeFromUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope posts authored by candidates.
     */
    public function scopeForCandidates($query)
    {
        return $query->where('author_type', 'candidate');
    }

    /**
     * Scope posts authored by companies.
     */
    public function scopeForCompanies($query)
    {
        return $query->where('author_type', 'company');
    }

    /**
     * Check if a user likes this post.
     */
    public function isLikedBy($userId): bool
    {
        return $this->likes()->where('user_id', $userId)->exists();
    }

    /**
     * Accessor for the normalized audience skill list.
     *
     * @psalm-return array<int, mixed>
     */
    public function getAudienceSkillListAttribute(): array
    {
        return collect($this->audience_skills ?? [])->filter()->values()->all();
    }

    /**
     * Get the count of comments.
     */
    public function getCommentsCountAttribute(): int
    {
        if (array_key_exists('comments_count', $this->attributes)) {
            return (int) $this->attributes['comments_count'];
        }

        if ($this->relationLoaded('comments')) {
            return $this->getRelation('comments')->count();
        }

        return $this->comments()->count();
    }

    /**
     * Get the count of likes.
     */
    public function getLikesCountAttribute(): int
    {
        if (array_key_exists('likes_count', $this->attributes)) {
            return (int) $this->attributes['likes_count'];
        }

        if ($this->relationLoaded('likes')) {
            return $this->getRelation('likes')->count();
        }

        return $this->likes()->count();
    }
}
