<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $social_live_stream_id
 * @property \Illuminate\Support\Carbon $captured_at
 * @property int $concurrent_viewers
 * @property int $new_followers
 * @property float $tips_total
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialLiveStream $stream
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamMetric newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamMetric newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamMetric query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamMetric whereCapturedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamMetric whereConcurrentViewers($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamMetric whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamMetric whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamMetric whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamMetric whereNewFollowers($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamMetric whereSocialLiveStreamId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamMetric whereTipsTotal($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamMetric whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialLiveStreamMetric extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_live_stream_id',
        'captured_at',
        'concurrent_viewers',
        'new_followers',
        'tips_total',
        'meta',
    ];

    protected $casts = [
        'captured_at' => 'datetime',
        'concurrent_viewers' => 'integer',
        'new_followers' => 'integer',
        'tips_total' => 'float',
        'meta' => 'array',
    ];

    public function stream(): BelongsTo
    {
        return $this->belongsTo(SocialLiveStream::class, 'social_live_stream_id');
    }
}

