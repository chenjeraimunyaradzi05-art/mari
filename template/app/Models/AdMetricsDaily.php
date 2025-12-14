<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $campaign_id
 * @property \Illuminate\Support\Carbon $date
 * @property int $impressions
 * @property int $clicks
 * @property int $views
 * @property int $watch_time_s
 * @property int $leads
 * @property int $cost_cents
 * @property int $conversions
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\AdCampaign $campaign
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily whereCampaignId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily whereClicks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily whereConversions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily whereCostCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily whereDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily whereImpressions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily whereLeads($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily whereViews($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdMetricsDaily whereWatchTimeS($value)
 *
 * @mixin \Eloquent
 */
final class AdMetricsDaily extends Model
{
    use HasFactory;

    protected $fillable = [
        'campaign_id',
        'date',
        'impressions',
        'clicks',
        'views',
        'watch_time_s',
        'leads',
        'cost_cents',
        'conversions',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(AdCampaign::class, 'campaign_id');
    }
}
