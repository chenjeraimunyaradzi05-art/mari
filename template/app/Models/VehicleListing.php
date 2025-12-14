<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Cviebrock\EloquentSluggable\Sluggable;

/**
 * @property int $id
 * @property int $dealer_id
 * @property string $title
 * @property string $slug
 * @property string $make
 * @property string $model
 * @property int $year
 * @property string $type
 * @property string $transmission
 * @property string $fuel_type
 * @property int $price_cents
 * @property int $odometer_km
 * @property string|null $description
 * @property array<array-key, mixed>|null $features
 * @property array<array-key, mixed>|null $images
 * @property string $status
 * @property bool $is_featured
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property string|null $powertrain_type
 * @property bool $rebate_eligible
 * @property numeric|null $rebate_amount
 * @property string|null $warranty_description
 * @property bool $is_certified_pre_owned
 * @property array<array-key, mixed>|null $pros
 * @property array<array-key, mixed>|null $cons
 * @property int|null $battery_range_km
 * @property int|null $charging_time_minutes
 * @property-read \App\Models\Dealer $dealer
 * @property-read string $formatted_price
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing findSimilarSlugs(string $attribute, array $config, string $slug)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereBatteryRangeKm($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereChargingTimeMinutes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereCons($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereDealerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereFeatures($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereFuelType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereImages($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereIsCertifiedPreOwned($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereIsFeatured($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereMake($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereModel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereOdometerKm($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing wherePowertrainType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing wherePriceCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing wherePros($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereRebateAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereRebateEligible($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereTransmission($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereWarrantyDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing whereYear($final value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleListing withUniqueSlugConstraints(\Illuminate\Database\Eloquent\Model $model, string $attribute, array $config, string $slug)
 * @mixin \Eloquent
 */
final class VehicleListing extends Model
{
    use HasFactory, Sluggable;

    protected $fillable = [
        'dealer_id',
        'title',
        'slug',
        'make',
        'model',
        'year',
        'type',
        'transmission',
        'fuel_type',
        'price_cents',
        'odometer_km',
        'description',
        'features',
        'images',
        'status',
        'is_featured',
        'powertrain_type',
        'rebate_eligible',
        'rebate_amount',
        'warranty_description',
        'is_certified_pre_owned',
        'pros',
        'cons',
        'battery_range_km',
        'charging_time_minutes',
    ];

    protected $casts = [
        'features' => 'array',
        'images' => 'array',
        'is_featured' => 'boolean',
        'rebate_eligible' => 'boolean',
        'is_certified_pre_owned' => 'boolean',
        'pros' => 'array',
        'cons' => 'array',
        'rebate_amount' => 'decimal:2',
    ];

    /**
     * @return string[][]
     *
     * @psalm-return array{slug: array{source: 'title'}}
     */
    #[\Override]
    public function sluggable(): array
    {
        return [
            'slug' => [
                'source' => 'title'
            ]
        ];
    }

    public function dealer(): BelongsTo
    {
        return $this->belongsTo(Dealer::class);
    }

    public function getFormattedPriceAttribute(): string
    {
        return '$' . number_format($this->price_cents / 100, 2);
    }
}
