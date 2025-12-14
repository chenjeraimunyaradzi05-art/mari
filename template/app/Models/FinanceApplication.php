<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $vehicle_listing_id
 * @property numeric $loan_amount
 * @property int $term_months
 * @property numeric $annual_income
 * @property string $employment_status
 * @property string $status
 * @property array<array-key, mixed>|null $provider_responses
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 * @property-read \App\Models\VehicleListing|null $vehicleListing
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinanceApplication newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinanceApplication newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinanceApplication query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinanceApplication whereAnnualIncome($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinanceApplication whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinanceApplication whereEmploymentStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinanceApplication whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinanceApplication whereLoanAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinanceApplication whereProviderResponses($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinanceApplication whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinanceApplication whereTermMonths($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinanceApplication whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<final static>|FinanceApplication whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|FinanceApplication whereVehicleListingId($value)
 *
 * @mixin \Eloquent
 */
final class FinanceApplication extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'vehicle_listing_id',
        'loan_amount',
        'term_months',
        'annual_income',
        'employment_status',
        'status',
        'provider_responses',
    ];

    protected $casts = [
        'provider_responses' => 'array',
        'loan_amount' => 'decimal:2',
        'annual_income' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function vehicleListing(): BelongsTo
    {
        return $this->belongsTo(VehicleListing::class);
    }
}
