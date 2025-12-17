<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $social_live_stream_id
 * @property int|null $social_profile_id
 * @property float $amount
 * @property string $currency
 * @property array<array-key, mixed>|null $payload
 * @property \Illuminate\Support\Carbon $recorded_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialProfile|null $profile
 * @property-read \App\Models\SocialLiveStream $stream
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamGift newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamGift newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamGift query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamGift whereAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamGift whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamGift whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamGift whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamGift wherePayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamGift whereRecordedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamGift whereSocialLiveStreamId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<staticfinal >|SocialLiveStreamGift whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialLiveStreamGift whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialLiveStreamGift extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_live_stream_id',
        'social_profile_id',
        'amount',
        'currency',
        'payload',
        'recorded_at',
    ];

    protected $casts = [
        'amount' => 'float',
        'payload' => 'array',
        'recorded_at' => 'datetime',
    ];

    public function stream(): BelongsTo
    {
        return $this->belongsTo(SocialLiveStream::class, 'social_live_stream_id');
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }
}
