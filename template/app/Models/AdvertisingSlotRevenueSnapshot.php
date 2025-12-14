<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int|null $slot_id
 * @property string $slot_key
 * @property \Illuminate\Support\Carbon $report_date
 * @property int $impressions
 * @property int $clicks
 * @property int $conversions
 * @property int $spend_cents
 * @property numeric $pipeline_value
 * @property int $partner_count
 * @property array<array-key, mixed>|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read float $spend
 * @property-read \App\Models\AdvertisingSlot|null $slot
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot whereClicks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot whereConversions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot whereImpressions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot wherePartnerCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot wherePipelineValue($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot whereReportDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot whereSlotId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot whereSlotKey($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot whereSpendCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlotRevenueSnapshot whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class AdvertisingSlotRevenueSnapshot extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'report_date' => 'date',
        'pipeline_value' => 'decimal:2',
        'notes' => 'array',
    ];

    public function slot(): BelongsTo
    {
        return $this->belongsTo(AdvertisingSlot::class, 'slot_id');
    }

    public function getSpendAttribute(): float
    {
        return round(((int) $this->spend_cents) / 100, 2);
    }
}
