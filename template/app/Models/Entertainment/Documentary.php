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
 * @property-read mixed $narrator
 * @property-read mixed $subjects
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
 * @method static Builder<static>|Documentary active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary onlyTrashed()
 * @method static Builder<static>|Documentary public()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary query()
 * @method static Builder<static>|Documentary visible()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereAiEngagementScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereAiModerationMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereAiTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereCaption($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereCommentsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereCommentsDisabled($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereContent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereContentFormat($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereIsPinned($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereIsSponsored($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereLikesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereMedia($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereMentions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereModerationStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary wherePinnedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary wherePostType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary wherePostableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary wherePostableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereReactionBreakdown($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereSharesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereStreamContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereViewsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary whereVisibility($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Documentary withoutTrashed()
 * @mixin \Eloquent
 */
final class Documentary extends EntertainmentBase
{
    /**
     * @return string[]
     *
     * @psalm-return list{'documentary'}
     */
    #[\Override]
    protected static function getPostTypes(): array
    {
        return ['documentary'];
    }

    /**
     * @return string
     *
     * @psalm-return 'documentary'
     */
    #[\Override]
    protected static function getDefaultPostType(): string
    {
        return 'documentary';
    }

    public function getNarratorAttribute()
    {
        return $this->getMeta('narrator');
    }

    public function getSubjectsAttribute()
    {
        return $this->getMeta('subjects');
    }
}

