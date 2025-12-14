<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $commerce_channel_id
 * @property string $status
 * @property float $amount
 * @property string $currency
 * @property \Illuminate\Support\Carbon|null $payout_date
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommerceChannel $channel
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommerceOrder> $orders
 * @property int|null orders_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommercePayoutBatch newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommercePayoutBatch newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommercePayoutBatch query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommercePayoutBatch whereAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommercePayoutBatch whereCommerceChannelId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommercePayoutBatch whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommercePayoutBatch whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommercePayoutBatch whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommercePayoutBatch whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommercePayoutBatch wherePayoutDate($value)final
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommercePayoutBatch whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommercePayoutBatch whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CommercePayoutBatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'commerce_channel_id',
        'status',
        'amount',
        'currency',
        'payout_date',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'float',
        'payout_date' => 'datetime',
        'metadata' => 'array',
    ];

    public function channel(): BelongsTo
    {
        return $this->belongsTo(CommerceChannel::class, 'commerce_channel_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(CommerceOrder::class, 'commerce_payout_batch_id');
    }
}
