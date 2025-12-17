<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property string $postable_type
 * @property int $postable_id
 * @property int $user_id
 * @property int|null $social_profile_id
 * @property string|null $post_type
 * @property string|null $content_format
 * @property string|null $caption
 * @property string $type
 * @property string|null $content
 * @property \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialMedia> $media
 * @property string|null $location
 * @property array<array-key, mixed>|null $tags
 * @property array<array-key, mixed>|null $mentions
 * @property int|null $likes_count
 * @property array<array-key, mixed>|null $reaction_breakdown
 * @property int|null $comments_count
 * @property int|null $shares_count
 * @property int $views_count
 * @property bool $is_pinned
 * @property bool $comments_disabled
 * @property array<array-key, mixed>|null $meta
 * @property array<array-key, mixed>|null $stream_context
 * @property string $visibility
 * @property string $moderation_status
 * @property bool $is_sponsored
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property float $ai_engagement_score
 * @property array<array-key, mixed>|null $ai_tags
 * @property array<array-key, mixed>|null $ai_moderation_meta
 * @property string|null $pinned_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialComment> $allComments
 * @property int|null $all_comments_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostCollectionItem> $collectionItems
 * @property int|null $collection_items_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialComment> $comments
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommerceOrder> $commerceOrders
 * @property int|null $commerce_orders_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostImpression> $impressions
 * @property int|null $impressions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialLike> $likes
 * @property-read \App\Models\SocialLiveStream|null $liveStream
 * @property int|null $media_count
 * @property-read \App\Models\SocialPostPoll|null $poll
 * @property-read Model|\Eloquent $postable
 * @property-read \App\Models\SocialProfile|null $profile
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialLike> $reactions
 * @property int|null $reactions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostSave> $saves
 * @property int|null $saves_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostShare> $shares
 * @property-read \App\Models\User $user
 * @method static Builder<static>|SocialPost active()
 * @method static \Database\Factories\SocialPostFactory factory($count = null, $state = [])
 * @method static Builder<static>|SocialPost newModelQuery()
 * @method static Builder<static>|SocialPost newQuery()
 * @method static Builder<static>|SocialPost onlyTrashed()
 * @method static Builder<static>|SocialPost public()
 * @method static Builder<static>|SocialPost query()
 * @method static Builder<static>|SocialPost visible()
 * @method static Builder<static>|SocialPost whereAiEngagementScore($value)
 * @method static Builder<static>|SocialPost whereAiModerationMeta($value)
 * @method static Builder<static>|SocialPost whereAiTags($value)
 * @method static Builder<static>|SocialPost whereCaption($value)
 * @method static Builder<static>|SocialPost whereCommentsCount($value)
 * @method static Builder<static>|SocialPost whereCommentsDisabled($value)
 * @method static Builder<static>|SocialPost whereContent($value)
 * @method static Builder<static>|SocialPost whereContentFormat($value)
 * @method static Builder<static>|SocialPost whereCreatedAt($value)
 * @method static Builder<static>|SocialPost whereDeletedAt($value)
 * @method static Builder<static>|SocialPost whereExpiresAt($value)
 * @method static Builder<static>|SocialPost whereId($value)
 * @method static Builder<static>|SocialPost whereIsPinned($value)
 * @method static Builder<static>|SocialPost whereIsSponsored($value)
 * @method static Builder<static>|SocialPost whereLikesCount($value)
 * @method static Builder<static>|SocialPost whereLocation($value)
 * @method static Builder<static>|SocialPost whereMedia($value)
 * @method static Builder<static>|SocialPost whereMentions($value)
 * @method static Builder<static>|SocialPost whereMeta($value)
 * @method static Builder<static>|SocialPost whereModerationStatus($value)
 * @method static Builder<static>|SocialPost wherePinnedAt($value)
 * @method static Builder<static>|SocialPost wherePostType($value)
 * @method static Builder<static>|SocialPost wherePostableId($value)
 * @method static Builder<static>|SocialPost wherePostableType($value)
 * @method static Builder<static>|SocialPost wherePublishedAt($value)
 * @method static Builder<static>|SocialPost whereReactionBreakdown($value)
 * @method static Builder<static>|SocialPost whereSharesCount($value)
 * @method static Builder<static>|SocialPost whereSocialProfileId($value)
 * @method static Builder<static>|SocialPost whereStreamContext($value)
 * @method static Builder<static>|SocialPost whereTags($value)
 * @method static Builder<static>|SocialPost whereType($value)
 * @method static Builder<static>|SocialPost whereUpdatedAt($value)
 * @method static Builder<static>|SocialPost whereUserId($value)
 * @method static Builder<static>|SocialPost whereViewsCount($value)
 * @method static Builder<static>|SocialPost whereVisibility($value)
 * @method static Builder<static>|SocialPost withTrashed(bool $withTrashed = true)
 * @method static Builder<static>|SocialPost withoutTrashed()
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostProgress> $progress
 * @property int|null progress_count
 * @mixin \Eloquent
 */
class SocialPost extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'social_profile_id',
        'user_id',
        'postable_type',
        'postable_id',
        'type',
        'post_type',
        'content_format',
        'content',
        'caption',
        'meta',
        'media',
        'stream_context',
        'location',
        'tags',
        'mentions',
        'likes_count',
        'reaction_breakdown',
        'comments_count',
        'shares_count',
        'views_count',
        'is_pinned',
        'comments_disabled',
        'visibility',
        'moderation_status',
        'is_sponsored',
        'published_at',
        'expires_at',
        'ai_engagement_score',
        'ai_tags',
        'ai_moderation_meta',
    ];

    protected $casts = [
        'meta' => 'array',
        'media' => 'array',
        'stream_context' => 'array',
        'tags' => 'array',
        'mentions' => 'array',
        'ai_tags' => 'array',
        'ai_moderation_meta' => 'array',
        'is_pinned' => 'boolean',
        'comments_disabled' => 'boolean',
        'is_sponsored' => 'boolean',
        'likes_count' => 'integer',
        'reaction_breakdown' => 'array',
        'comments_count' => 'integer',
        'shares_count' => 'integer',
        'views_count' => 'integer',
        'published_at' => 'datetime',
        'expires_at' => 'datetime',
        'ai_engagement_score' => 'float',
    ];

    public function postable(): MorphTo
    {
        return $this->morphTo();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }

    public function media(): HasMany
    {
        return $this->hasMany(SocialMedia::class, 'social_post_id')->orderBy('order');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(SocialComment::class, 'social_post_id')
            ->whereNull('parent_id')
            ->latest();
    }

    public function allComments(): HasMany
    {
        return $this->hasMany(SocialComment::class, 'social_post_id')->latest();
    }

    public function likes(): MorphMany
    {
        return $this->morphMany(SocialLike::class, 'likeable');
    }

    public function saves(): HasMany
    {
        return $this->hasMany(SocialPostSave::class, 'social_post_id');
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(SocialLike::class, 'social_post_id');
    }

    public function shares(): HasMany
    {
        return $this->hasMany(SocialPostShare::class, 'social_post_id');
    }

    public function impressions(): HasMany
    {
        return $this->hasMany(SocialPostImpression::class, 'social_post_id');
    }

    public function progress(): HasMany
    {
        return $this->hasMany(SocialPostProgress::class, 'social_post_id');
    }

    public function poll(): HasOne
    {
        return $this->hasOne(SocialPostPoll::class);
    }

    public function liveStream(): HasOne
    {
        return $this->hasOne(SocialLiveStream::class);
    }

    public function collectionItems(): HasMany
    {
        return $this->hasMany(SocialPostCollectionItem::class);
    }

    public function commerceOrders(): HasMany
    {
        return $this->hasMany(CommerceOrder::class, 'source_social_post_id');
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query
            ->where(function (Builder $builder) {
                $builder
                    ->whereNull('published_at')
                    ->orWhere('published_at', '<=', now());
            })
            ->where(function (Builder $builder) {
                $builder
                    ->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            });
    }

    public function scopeVisible(Builder $query): Builder
    {
        return $query
            ->where('moderation_status', 'approved')
            ->active();
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopePublic(Builder $query): Builder
    {
        return $query->where('visibility', 'public');
    }

    public function incrementViews(): void
    {
        $this->increment('views_count');
    }

    public function refreshReactionBreakdown(): array
    {
        $summary = $this->likes()
            ->selectRaw('LOWER(COALESCE(reaction, ?)) as reaction, COUNT(*) as total', ['like'])
            ->groupBy('reaction')
            ->pluck('total', 'reaction')
            ->toArray();

        $this->forceFill(['reaction_breakdown' => $summary])->save();

        return $summary;
    }

    /**
     * Set a metadata value.
     *
     * @param string $key
     * @param mixed $value
     * @return $this
     */
    public function setMeta(string $key, mixed $value): self
    {
        $meta = $this->meta ?? [];
        $meta[$key] = $value;
        $this->meta = $meta;
        return $this;
    }

    /**
     * Get a metadata value.
     *
     * @param string $key
     * @param mixed $default
     * @return mixed
     */
    public function getMeta(string $key, mixed $default = null): mixed
    {
        return $this->meta[$key] ?? $default;
    }
}
