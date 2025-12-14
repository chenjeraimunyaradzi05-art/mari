<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $company_id
 * @property string $event_type
 * @property int|null $job_id
 * @property int|null $candidate_user_id
 * @property int|null $applied_job_id
 * @property bool $eligible
 * @property \Illuminate\Support\Carbon $occurred_at
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\AppliedJob|null $application
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\BillingCharge> $charges
 * @property int|null charges_count
 * @property-read \App\Models\Company $company
 * @property-read \App\Models\Job|null $job
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter whereAppliedJobId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter whereCandidateUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter whereCompanyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter whereEligible($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter whereEventType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter whereJobId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter whereOccurredAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingMeter whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class BillingMeter extends Model
{
    use HasFactory;

    public const EVENT_APPLICATION_SUBMITTED = 'ppa_application_submitted';

    protected $fillable = [
        'company_id',
        'event_type',
        'job_id',
        'candidate_user_id',
        'applied_job_id',
        'eligible',
        'occurred_at',
        'meta',
    ];

    protected $casts = [
        'eligible' => 'boolean',
        'occurred_at' => 'datetime',
        'meta' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(Job::class);
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(AppliedJob::class, 'applied_job_id');
    }

    public function charges(): HasMany
    {
        return $this->hasMany(BillingCharge::class, 'meter_id');
    }
}
