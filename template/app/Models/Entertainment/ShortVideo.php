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
 * @property-read mixed $effects
 * @property-read mixed $music_track
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
 * @method static Builder<static>|ShortVideo active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo onlyTrashed()
 * @method static Builder<static>|ShortVideo public()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo query()
 * @method static Builder<static>|ShortVideo visible()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereAiEngagementScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereAiModerationMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereAiTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereCaption($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereCommentsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereCommentsDisabled($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereContent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereContentFormat($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereIsPinned($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereIsSponsored($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereLikesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereMedia($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereMentions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereModerationStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo wherePinnedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo wherePostType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo wherePostableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo wherePostableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereReactionBreakdown($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereSharesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereStreamContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereViewsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo whereVisibility($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortVideo withoutTrashed()
 * @mixin \Eloquent
 */
final class ShortVideo extends EntertainmentBase
{
    /**
     * @return string[]
     *
     * @psalm-return list{'short_video'}
     */
    #[\Override]
    protected static function getPostTypes(): array
    {
        return ['short_video'];
    }

    /**
     * @return string
     *
     * @psalm-return 'short_video'
     */
    #[\Override]
    protected static function getDefaultPostType(): string
    {
        return 'short_video';
    }

    // Accessors for Short Video specific meta
    public function getMusicTrackAttribute()
    {
        return $this->getMeta('music_track');
    }

    public function getEffectsAttribute()
    {
        return $this->getMeta('effects');
    }
}

