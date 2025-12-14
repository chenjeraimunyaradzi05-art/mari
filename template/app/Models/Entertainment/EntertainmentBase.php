<?php

namespace App\Models\Entertainment;

use App\Models\SocialPost;
use Illuminate\Database\Eloquent\Builder;

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
 * @method static Builder<static>|EntertainmentBase active()
 * @method static Builder<static>|EntertainmentBase newModelQuery()
 * @method static Builder<static>|EntertainmentBase newQuery()
 * @method static Builder<static>|EntertainmentBase onlyTrashed()
 * @method static Builder<static>|EntertainmentBase public()
 * @method static Builder<static>|EntertainmentBase query()
 * @method static Builder<static>|EntertainmentBase visible()
 * @method static Builder<static>|EntertainmentBase whereAiEngagementScore($value)
 * @method static Builder<static>|EntertainmentBase whereAiModerationMeta($value)
 * @method static Builder<static>|EntertainmentBase whereAiTags($value)
 * @method static Builder<static>|EntertainmentBase whereCaption($value)
 * @method static Builder<static>|EntertainmentBase whereCommentsCount($value)
 * @method static Builder<static>|EntertainmentBase whereCommentsDisabled($value)
 * @method static Builder<static>|EntertainmentBase whereContent($value)
 * @method static Builder<static>|EntertainmentBase whereContentFormat($value)
 * @method static Builder<static>|EntertainmentBase whereCreatedAt($value)
 * @method static Builder<static>|EntertainmentBase whereDeletedAt($value)
 * @method static Builder<static>|EntertainmentBase whereExpiresAt($value)
 * @method static Builder<static>|EntertainmentBase whereId($value)
 * @method static Builder<static>|EntertainmentBase whereIsPinned($value)
 * @method static Builder<static>|EntertainmentBase whereIsSponsored($value)
 * @method static Builder<static>|EntertainmentBase whereLikesCount($value)
 * @method static Builder<static>|EntertainmentBase whereLocation($value)
 * @method static Builder<static>|EntertainmentBase whereMedia($value)
 * @method static Builder<static>|EntertainmentBase whereMentions($value)
 * @method static Builder<static>|EntertainmentBase whereMeta($value)
 * @method static Builder<static>|EntertainmentBase whereModerationStatus($value)
 * @method static Builder<static>|EntertainmentBase wherePinnedAt($value)
 * @method static Builder<static>|EntertainmentBase wherePostType($value)
 * @method static Builder<static>|EntertainmentBase wherePostableId($value)
 * @method static Builder<static>|EntertainmentBase wherePostableType($value)
 * @method static Builder<static>|EntertainmentBase wherePublishedAt($value)
 * @method static Builder<static>|EntertainmentBase whereReactionBreakdown($value)
 * @method static Builder<static>|EntertainmentBase whereSharesCount($value)
 * @method static Builder<static>|EntertainmentBase whereSocialProfileId($value)
 * @method static Builder<static>|EntertainmentBase whereStreamContext($value)
 * @method static Builder<static>|EntertainmentBase whereTags($value)
 * @method static Builder<static>|EntertainmentBase whereType($value)
 * @method static Builder<static>|EntertainmentBase whereUpdatedAt($value)
 * @method static Builder<static>|EntertainmentBase whereUserId($value)
 * @method static Builder<static>|EntertainmentBase whereViewsCount($value)
 * @method static Builder<static>|EntertainmentBase whereVisibility($value)
 * @method static Builder<static>|EntertainmentBase withTrashed(bool $withTrashed = true)
 * @method static Builder<static>|EntertainmentBase withoutTrashed()
 * @mixin \Eloquent
 */
class EntertainmentBase extends SocialPost
{
    protected $table = 'social_posts';

    #[\Override]
    public static function boot()
    {
        parent::boot();

        static::addGlobalScope('entertainment_type', function (Builder $builder) {
            $builder->whereIn('post_type', static::getPostTypes());
        });

        static::creating(function ($model) {
            if (!$model->post_type) {
                $model->post_type = static::getDefaultPostType();
            }
        });
    }

    /**
     * @return array
     *
     * @psalm-return array<never, never>
     */
    protected static function getPostTypes(): array
    {
        return [];
    }

    /**
     * @return string
     *
     * @psalm-return 'entertainment'
     */
    protected static function getDefaultPostType(): string
    {
        return 'entertainment';
    }

    /**
     * Get metadata value by key.
     */
    #[\Override]
    public function getMeta(string $key, mixed $default = null): mixed
    {
        return data_get($this->meta, $key, $default);
    }

    /**
     * Set metadata value by key.
     */
    #[\Override]
    public function setMeta(string $key, mixed $value): \App\Models\SocialPost
    {
        $meta = $this->meta ?? [];
        data_set($meta, $key, $value);
        $this->meta = $meta;
        return $this;
    }
}
