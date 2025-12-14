<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $campaign_id
 * @property \Illuminate\Support\Carbon $recorded_at
 * @property int $impressions
 * @property int $clicks
 * @property int $conversions
 * @property int $qualified_leads
 * @property int $spend_cents
 * @property numeric $pipeline_value
 * @property array<array-key, mixed>|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\AdvertisingCampaign $campaign
 * @property-read float $cpa
 * @property-read float $cpc
 * @property-read float $ctr
 * @property-read float $spend
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric whereCampaignId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric whereClicks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric whereConversions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric whereImpressions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric wherePipelineValue($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric whereQualifiedLeads($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric whereRecordedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric whereSpendCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaignMetric whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class AdvertisingCampaignMetric extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'recorded_at' => 'date',
        'pipeline_value' => 'decimal:2',
        'notes' => 'array',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(AdvertisingCampaign::class, 'campaign_id');
    }

    public function getCtrAttribute(): float
    {
        $impressions = (int) $this->impressions;
        $clicks = (int) $this->clicks;

        if ($impressions === 0) {
            return 0.0;
        }

        return round(($clicks / $impressions) * 100, 2);
    }

    public function getCpcAttribute(): float
    {
        $clicks = (int) $this->clicks;

        if ($clicks === 0) {
            return 0.0;
        }

        return round(($this->spend_cents / 100) / $clicks, 2);
    }

    public function getCpaAttribute(): float
    {
        $conversions = (int) $this->conversions;

        if ($conversions === 0) {
            return 0.0;
        }

        return round(($this->spend_cents / 100) / $conversions, 2);
    }

    public function getSpendAttribute(): float
    {
        return round($this->spend_cents / 100, 2);
    }
}
