<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $commerce_channel_id
 * @property int|null $buyer_profile_id
 * @property int|null $commerce_payout_batch_id
 * @property int|null $source_social_post_id
 * @property string $status
 * @property float $total
 * @property string $currency
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $placed_at
 * @property \Illuminate\Support\Carbon|null $fulfilled_at
 * @property \Illuminate\Support\Carbon|null $canceled_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialProfile|null $buyer
 * @property-read \App\Models\CommerceChannel $channel
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommerceOrderEvent> $events
 * @property int|null events_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommerceOrderItem> $items
 * @property int|null items_count
 * @property-read \App\Models\CommercePayoutBatch|null $payoutBatch
 * @property-read \App\Models\SocialPost|null $sourcePost
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder whereBuyerProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder whereCanceledAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder whereCommerceChannelId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder whereCommercePayoutBatchId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder whereFulfilledAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder wherePlacedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder whereSourceSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder whereTotal($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrder whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CommerceOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'commerce_channel_id',
        'buyer_profile_id',
        'commerce_payout_batch_id',
        'source_social_post_id',
        'status',
        'total',
        'currency',
        'metadata',
        'placed_at',
        'fulfilled_at',
        'canceled_at',
    ];

    protected $casts = [
        'total' => 'float',
        'metadata' => 'array',
        'placed_at' => 'datetime',
        'fulfilled_at' => 'datetime',
        'canceled_at' => 'datetime',
    ];

    public function channel(): BelongsTo
    {
        return $this->belongsTo(CommerceChannel::class, 'commerce_channel_id');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'buyer_profile_id');
    }

    public function payoutBatch(): BelongsTo
    {
        return $this->belongsTo(CommercePayoutBatch::class, 'commerce_payout_batch_id');
    }

    public function sourcePost(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'source_social_post_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(CommerceOrderItem::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(CommerceOrderEvent::class);
    }
}
