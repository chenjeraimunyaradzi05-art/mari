<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $social_post_id
 * @property int|null $community_group_id
 * @property string $title
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $scheduled_for
 * @property \Illuminate\Support\Carbon|null $started_at
 * @property \Illuminate\Support\Carbon|null $ended_at
 * @property string|null $ingest_url
 * @property string|null $playback_url
 * @property string|null $stream_key
 * @property int $max_viewers
 * @property int $total_watch_time
 * @property array<array-key, mixed>|null $stream_context
 * @property array<array-key, mixed>|null $ai_moderation_meta
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommunityGroup|null $communityGroup
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialLiveStreamGift> $gifts
 * @property int|null gifts_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialLiveStreamMetric> $metrics
 * @property int|null metrics_count
 * @property-read \App\Models\SocialPost $post
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereAiModerationMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereCommunityGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereEndedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereIngestUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereMaxViewers($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream wherePlaybackUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereScheduledFor($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereStartedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereStreamContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereStreamKey($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereTitle($value)
final  * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereTotalWatchTime($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStream whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialLiveStream extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_post_id',
        'community_group_id',
        'title',
        'status',
        'scheduled_for',
        'started_at',
        'ended_at',
        'ingest_url',
        'playback_url',
        'stream_key',
        'max_viewers',
        'total_watch_time',
        'stream_context',
        'ai_moderation_meta',
        'metadata',
    ];

    protected $casts = [
        'scheduled_for' => 'datetime',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'max_viewers' => 'integer',
        'total_watch_time' => 'integer',
        'stream_context' => 'array',
        'ai_moderation_meta' => 'array',
        'metadata' => 'array',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }

    public function communityGroup(): BelongsTo
    {
        return $this->belongsTo(CommunityGroup::class);
    }

    public function metrics(): HasMany
    {
        return $this->hasMany(SocialLiveStreamMetric::class);
    }

    public function gifts(): HasMany
    {
        return $this->hasMany(SocialLiveStreamGift::class);
    }

    public function markStarted(): void
    {
        $this->forceFill([
            'status' => 'live',
            'started_at' => $this->started_at ?? now(),
        ])->save();
    }

    public function markEnded(): void
    {
        $this->forceFill([
            'status' => 'ended',
            'ended_at' => $this->ended_at ?? now(),
        ])->save();
    }
}
