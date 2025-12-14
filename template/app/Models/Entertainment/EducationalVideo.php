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
 * @property-read mixed $difficulty
 * @property-read mixed $skills_taught
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
 * @method static Builder<static>|EducationalVideo active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo onlyTrashed()
 * @method static Builder<static>|EducationalVideo public()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo query()
 * @method static Builder<static>|EducationalVideo visible()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereAiEngagementScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereAiModerationMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereAiTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereCaption($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereCommentsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereCommentsDisabled($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereContent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereContentFormat($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereIsPinned($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereIsSponsored($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereLikesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereMedia($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereMentions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereModerationStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo wherePinnedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo wherePostType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo wherePostableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo wherePostableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereReactionBreakdown($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereSharesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereStreamContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereViewsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo whereVisibility($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EducationalVideo withoutTrashed()
 * @mixin \Eloquent
 */
final class EducationalVideo extends EntertainmentBase
{
    /**
     * @return string[]
     *
     * @psalm-return list{'educational'}
     */
    #[\Override]
    protected static function getPostTypes(): array
    {
        return ['educational'];
    }

    /**
     * @return string
     *
     * @psalm-return 'educational'
     */
    #[\Override]
    protected static function getDefaultPostType(): string
    {
        return 'educational';
    }

    public function getDifficultyAttribute()
    {
        return $this->getMeta('difficulty');
    }

    public function getSkillsTaughtAttribute()
    {
        return $this->getMeta('skills_taught');
    }
}

