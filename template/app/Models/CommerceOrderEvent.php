<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $commerce_order_id
 * @property string $event_type
 * @property array<array-key, mixed>|null $payload
 * @property int|null $recorded_by
 * @property \Illuminate\Support\Carbon $recorded_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommerceOrder $order
 * @property-read \App\Models\User|null $recordedBy
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderEvent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderEvent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderEvent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderEvent whereCommerceOrderId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderEvent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderEvent whereEventType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderEvent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderEvent wherePayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderEvent whereRecordedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderEvent whereRecordedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderEvent whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CommerceOrderEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'commerce_order_id',
        'event_type',
        'payload',
        'recorded_by',
        'recorded_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'recorded_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(CommerceOrder::class, 'commerce_order_id');
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
