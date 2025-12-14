<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int $public_sector_agency_id
 * @property int|null $created_by
 * @property string $title
 * @property string|null $reference_code
 * @property string|null $category
 * @property string $pipeline_stage
 * @property string $status
 * @property string|null $budget_band
 * @property string $priority_level
 * @property string $compliance_risk
 * @property string|null $delivery_region
 * @property array<array-key, mixed>|null $supplier_diversity_targets
 * @property array<array-key, mixed>|null $key_dates
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $opens_at
 * @property \Illuminate\Support\Carbon|null $closes_at
 * @property bool $is_published
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\PublicSectorAgency $agency
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CivicOpportunitySignup> $civicSignups
 * @property int|null civic_signups_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ComplianceTracker> $complianceTrackers
 * @property int|null compliance_trackers_count
 * @property-read \App\Models\User|null $creator
 * @property-read \App\Models\MissionBrief|null $missionBrief
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity published()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity stage(string $stage)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereBudgetBand($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereClosesAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereComplianceRisk($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereCreatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereDeliveryRegion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereIsPublished($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereKeyDates($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereOpensAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity wherePipelineStage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity wherePriorityLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity wherePublicSectorAgencyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereReferenceCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereSupplierDiversityTargets($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProcurementOpportunity whereUuid($value)
 *
 * @mixin \Eloquent
 */
final class ProcurementOpportunity extends Model
{
    use HasFactory;

    protected $fillable = [
        'public_sector_agency_id',
        'created_by',
        'uuid',
        'title',
        'reference_code',
        'category',
        'pipeline_stage',
        'status',
        'budget_band',
        'priority_level',
        'compliance_risk',
        'delivery_region',
        'supplier_diversity_targets',
        'key_dates',
        'metadata',
        'opens_at',
        'closes_at',
        'is_published',
    ];

    protected $casts = [
        'supplier_diversity_targets' => 'array',
        'key_dates' => 'array',
        'metadata' => 'array',
        'opens_at' => 'datetime',
        'closes_at' => 'datetime',
        'is_published' => 'boolean',
    ];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (self $opportunity): void {
            if (empty($opportunity->uuid)) {
                $opportunity->uuid = (string) Str::uuid();
            }
        });
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(PublicSectorAgency::class, 'public_sector_agency_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function missionBrief(): HasOne
    {
        return $this->hasOne(MissionBrief::class);
    }

    public function complianceTrackers(): HasMany
    {
        return $this->hasMany(ComplianceTracker::class);
    }

    public function civicSignups(): HasMany
    {
        return $this->hasMany(CivicOpportunitySignup::class);
    }

    public function scopeStage($query, string $stage)
    {
        return $query->where('pipeline_stage', $stage);
    }

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }

    public function stageLabel(): string
    {
        return match ($this->pipeline_stage) {
            'discovery' => 'Discovery',
            'briefing' => 'Mission briefing',
            'open' => 'Open for partners',
            'shortlist' => 'Shortlist',
            'awarded' => 'Awarded',
            'closed' => 'Closed',
            default => 'Archived',
        };
    }
}
