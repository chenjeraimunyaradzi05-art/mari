<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $org_page_id
 * @property string|null $name
 * @property string $objective
 * @property string $billing_model
 * @property int $budget_cents
 * @property int $spent_cents
 * @property \Illuminate\Support\Carbon $start_on
 * @property \Illuminate\Support\Carbon|null $end_on
 * @property array<array-key, mixed>|null $targeting
 * @property string $status
 * @property array<array-key, mixed>|null $optimisation
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\AdCreative> $creatives
 * @property int|null creatives_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\AdMetricsDaily> $dailyMetrics
 * @property int|null daily_metrics_count
 * @property-read \App\Models\OrganizationPage $page
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereBillingModel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereBudgetCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereEndOn($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereObjective($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereOptimisation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereOrgPageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereSpentCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereStartOn($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereTargeting($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCampaign withoutTrashed()
 *
 * @mixin \Eloquent
 */
final class AdCampaign extends Model
{
    use HasFactory, SoftDeletes;

    public const OBJECTIVES = ['reach', 'traffic', 'leads', 'applications'];

    public const BILLING_MODELS = ['cpm', 'cpc', 'cpa'];

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

    protected $fillable = [
        'org_page_id',
        'name',
        'objective',
        'billing_model',
        'budget_cents',
        'spent_cents',
        'start_on',
        'end_on',
        'targeting',
        'status',
        'optimisation',
    ];

    protected $casts = [
        'targeting' => 'array',
        'optimisation' => 'array',
        'start_on' => 'date',
        'end_on' => 'date',
    ];

    public function page(): BelongsTo
    {
        return $this->belongsTo(OrganizationPage::class, 'org_page_id');
    }

    public function creatives(): HasMany
    {
        return $this->hasMany(AdCreative::class, 'campaign_id');
    }

    public function dailyMetrics(): HasMany
    {
        return $this->hasMany(AdMetricsDaily::class, 'campaign_id');
    }
}
