<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $vehicle_listing_id
 * @property string $driver_age_range
 * @property string $parking_location
 * @property string $usage_type
 * @property numeric $estimated_annual_km
 * @property array<array-key, mixed>|null $quotes_received
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 * @property-read \App\Models\VehicleListing|null $vehicleListing
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InsuranceQuote newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InsuranceQuote newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InsuranceQuote query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InsuranceQuote whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InsuranceQuote whereDriverAgeRange($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InsuranceQuote whereEstimatedAnnualKm($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InsuranceQuote whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InsuranceQuote whereParkingLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InsuranceQuote whereQuotesReceived($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InsuranceQuote whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InsuranceQuote whereUsageType($value)
 * @method static \Illuminate\Database\Eloquent\\Builder<static>|InsuranceQuote whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InsuranceQuote whereVehicleListingId($value)
 *
 * @mixin \Eloquent
 */
final class InsuranceQuote extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'vehicle_listing_id',
        'driver_age_range',
        'parking_location',
        'usage_type',
        'estimated_annual_km',
        'quotes_received',
    ];

    protected $casts = [
        'quotes_received' => 'array',
        'estimated_annual_km' => 'decimal:2',
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
