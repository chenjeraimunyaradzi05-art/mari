<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $company_id
 * @property string $name
 * @property string $status
 * @property string $objective
 * @property array<array-key, mixed>|null $targeting
 * @property array<array-key, mixed>|null $tracking_parameters
 * @property numeric|null $daily_budget
 * @property numeric|null $lifetime_budget
 * @property \Illuminate\Support\Carbon|null $starts_at
 * @property \Illuminate\Support\Carbon|null $ends_at
 * @property string|null $creative_brief
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\AdvertisingAudienceSegment> $audienceSegments
 * @property int|null audience_segments_count
 * @property-read \App\Models\Company $company
 * @property-read \Illuminate\Database\Eloquent\Collection<int, AdvertisingCreative> $creatives
 * @property int|null creatives_count
 * @property-read string $objective_label
 * @property-read string $status_label
 * @property-read \Illuminate\Database\Eloquent\Collection<int, AdvertisingCampaignMetric> $metrics
 * @property int|null metrics_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereCompanyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereCreativeBrief($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereDailyBudget($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereEndsAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereLifetimeBudget($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereObjective($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereStartsAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereTargeting($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereTrackingParameters($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCampaign withoutTrashed()
 *
 * @mixin \Eloquent
 */
final class AdvertisingCampaign extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $guarded = [];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'targeting' => 'array',
        'tracking_parameters' => 'array',
        'daily_budget' => 'decimal:2',
        'lifetime_budget' => 'decimal:2',
    ];

    public const STATUS_DRAFT = 'draft';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_PAUSED = 'paused';

    public const STATUS_COMPLETED = 'completed';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_ACTIVE,
        self::STATUS_PAUSED,
        self::STATUS_COMPLETED,
    ];

    public const OBJECTIVES = [
        'awareness' => 'Brand Awareness',
        'lead_generation' => 'Lead Generation',
        'hiring' => 'Hiring Campaign',
        'event_promotion' => 'Event Promotion',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function audienceSegments(): BelongsToMany
    {
        return $this->belongsToMany(AdvertisingAudienceSegment::class, 'advertising_campaign_audience', 'campaign_id', 'segment_id')
            ->withPivot(['constraints'])
            ->withTimestamps();
    }

    public function creatives(): HasMany
    {
        return $this->hasMany(AdvertisingCreative::class, 'campaign_id');
    }

    public function metrics(): HasMany
    {
        return $this->hasMany(AdvertisingCampaignMetric::class, 'campaign_id');
    }

    public function getObjectiveLabelAttribute(): string
    {
        return self::OBJECTIVES[$this->objective] ?? ucfirst(str_replace('_', ' ', (string) $this->objective));
    }

    public function getStatusLabelAttribute(): string
    {
        return ucfirst(str_replace('_', ' ', (string) $this->status));
    }
}
