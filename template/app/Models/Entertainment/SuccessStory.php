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
 * @property-read mixed $company
 * @property-read mixed $featured_person
 * @property-read mixed $industry
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
 * @method static Builder<static>|SuccessStory active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory onlyTrashed()
 * @method static Builder<static>|SuccessStory public()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory query()
 * @method static Builder<static>|SuccessStory visible()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereAiEngagementScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereAiModerationMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereAiTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereCaption($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereCommentsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereCommentsDisabled($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereContent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereContentFormat($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereIsPinned($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereIsSponsored($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereLikesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereMedia($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereMentions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereModerationStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory wherePinnedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory wherePostType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory wherePostableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory wherePostableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereReactionBreakdown($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereSharesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereStreamContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereViewsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory whereVisibility($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SuccessStory withoutTrashed()
 * @mixin \Eloquent
 */
final class SuccessStory extends EntertainmentBase
{
    /**
     * @return string[]
     *
     * @psalm-return list{'success_story'}
     */
    #[\Override]
    protected static function getPostTypes(): array
    {
        return ['success_story'];
    }

    /**
     * @return string
     *
     * @psalm-return 'success_story'
     */
    #[\Override]
    protected static function getDefaultPostType(): string
    {
        return 'success_story';
    }

    public function getIndustryAttribute()
    {
        return $this->getMeta('industry');
    }

    public function getFeaturedPersonAttribute()
    {
        return $this->getMeta('featured_person');
    }

    public function getCompanyAttribute()
    {
        return $this->getMeta('company');
    }
}

