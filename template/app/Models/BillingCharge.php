<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $company_id
 * @property int|null $meter_id
 * @property string $charge_type
 * @property int $amount_cents
 * @property string $currency
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $billed_at
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Company $company
 * @property-read \App\Models\BillingMeter|null $meter
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingCharge newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingCharge newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingCharge query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingCharge whereAmountCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingCharge whereBilledAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingCharge whereChargeType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingCharge whereCompanyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingCharge whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingCharge whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingCharge whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingCharge whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingCharge whereMeterId($value)
 * @method static \Illuminate\Database\\Eloquent\Builder<static>|BillingCharge whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingCharge whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class BillingCharge extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_READY = 'ready';

    public const STATUS_INVOICED = 'invoiced';

    public const STATUS_VOID = 'void';

    protected $fillable = [
        'company_id',
        'meter_id',
        'charge_type',
        'amount_cents',
        'currency',
        'status',
        'billed_at',
        'meta',
    ];

    protected $casts = [
        'amount_cents' => 'integer',
        'billed_at' => 'datetime',
        'meta' => 'array',
    ];

    public function meter(): BelongsTo
    {
        return $this->belongsTo(BillingMeter::class, 'meter_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
