<?php

namespace App\Models\Entertainment;

/**
 * @property int $id
 * @property string $postable_type
 * @property int $postable_id
 * @property int $user_id
 * @property int|null $social_profile_id
 * @property string $post_type
 * @property string|null $content_format
 * @property string|null $caption
 * @property string $type
 * @property string|null $content
 * @property \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialMedia> $media
 * @property string|null $location
 * @property array<array-key, mixed>|null $tags
 * @property array<array-key, mixed>|null $mentions
 * @property int|null likes_count
 * @property array<array-key, mixed>|null $reaction_breakdown
 * @property int|null comments_count
 * @property int|null shares_count
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
 * @property int|null all_comments_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostCollectionItem> $collectionItems
 * @property int|null collection_items_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialComment> $comments
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommerceOrder> $commerceOrders
 * @property int|null commerce_orders_count
 * @property-read mixed $cast
 * @property-read mixed $director
 * @property-read mixed $rating
 * @property-read mixed $release_year
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostImpression> $impressions
 * @property int|null impressions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialLike> $likes
 * @property-read \App\Models\SocialLiveStream|null $liveStream
 * @property int|null media_count
 * @property-read \App\Models\SocialPostPoll|null $poll
 * @property-read \Illuminate\Database\Eloquent\Model|\Eloquent $postable
 * @property-read \App\Models\SocialProfile|null $profile
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostProgress> $progress
 * @property int|null progress_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialLike> $reactions
 * @property int|null reactions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostSave> $saves
 * @property int|null saves_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostShare> $shares
 * @property-read \App\Models\User $user
 * @method static Builder<static>|Movie active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie onlyTrashed()
 * @method static Builder<static>|Movie public()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie query()
 * @method static Builder<static>|Movie visible()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereAiEngagementScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereAiModerationMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereAiTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereCaption($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereCommentsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereCommentsDisabled($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereContent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereContentFormat($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereIsPinned($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereIsSponsored($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereLikesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereMedia($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereMentions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereModerationStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie wherePinnedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie wherePostType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie wherePostableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie wherePostableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereReactionBreakdown($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereSharesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereStreamContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereViewsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie whereVisibility($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Movie withoutTrashed()
 * @mixin \Eloquent
 */
final class Movie extends EntertainmentBase
{
    /**
     * @return string[]
     *
     * @psalm-return list{'movie'}
     */
    #[\Override]
    protected static function getPostTypes(): array
    {
        return ['movie'];
    }

    /**
     * @return string
     *
     * @psalm-return 'movie'
     */
    #[\Override]
    protected static function getDefaultPostType(): string
    {
        return 'movie';
    }

    public function getDirectorAttribute()
    {
        return $this->getMeta('director');
    }

    public function getCastAttribute()
    {
        return $this->getMeta('cast');
    }

    public function getRatingAttribute()
    {
        return $this->getMeta('rating');
    }

    public function getReleaseYearAttribute()
    {
        return $this->getMeta('release_year');
    }
}

