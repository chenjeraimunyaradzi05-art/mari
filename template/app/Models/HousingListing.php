<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int|null $org_page_id
 * @property int|null $landlord_user_id
 * @property string $title
 * @property string $slug
 * @property string $listing_type
 * @property string|null $property_type
 * @property bool $furnished
 * @property int|null $bedrooms
 * @property int|null $bathrooms
 * @property int|null $parking_spaces
 * @property int|null $rent_cents
 * @property string $rent_frequency
 * @property int|null $bond_cents
 * @property string $currency
 * @property \Illuminate\Support\Carbon|null $available_from
 * @property string|null $occupancy_preference
 * @property string $safety_level
 * @property array<array-key, mixed>|null $amenities
 * @property array<array-key, mixed>|null $house_rules
 * @property array<array-key, mixed>|null $safety_features
 * @property string|null $address_line1
 * @property string|null $address_line2
 * @property string|null $suburb
 * @property string|null $region
 * @property string|null $postcode
 * @property string|null $country
 * @property float|null $latitude
 * @property float|null $longitude
 * @property string $status
 * @property string $verification_status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \App\Models\User|null $landlord
 * @property-read \App\Models\OrganizationPage|null $organizationPage
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereAddressLine1($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereAddressLine2($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereAmenities($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereAvailableFrom($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereBathrooms($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereBedrooms($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereBondCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereCountry($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereFurnished($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereHouseRules($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereLandlordUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereLatitude($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereListingType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereLongitude($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereOccupancyPreference($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereOrgPageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereParkingSpaces($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing wherePostcode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing wherePropertyType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereRegion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereRentCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereRentFrequency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereSafetyFeatures($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereSafetyLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereSuburb($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereUuid($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing whereVerificationStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HousingListing withoutTrashed()
 * @method static \Database\Factories\HousingListingFactory factory($count = null, $state = [])
 *
 * @mixin \Eloquent
 */
final class HousingListing extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'org_page_id',
        'landlord_user_id',
        'title',
        'slug',
        'listing_type',
        'property_type',
        'furnished',
        'bedrooms',
        'bathrooms',
        'parking_spaces',
        'rent_cents',
        'rent_frequency',
        'bond_cents',
        'currency',
        'available_from',
        'occupancy_preference',
        'safety_level',
        'amenities',
        'house_rules',
        'safety_features',
        'address_line1',
        'address_line2',
        'suburb',
        'region',
        'postcode',
        'country',
        'latitude',
        'longitude',
        'status',
        'verification_status',
    ];

    protected $casts = [
        'furnished' => 'bool',
        'bedrooms' => 'int',
        'bathrooms' => 'int',
        'parking_spaces' => 'int',
        'rent_cents' => 'int',
        'bond_cents' => 'int',
        'available_from' => 'date',
        'amenities' => 'array',
        'house_rules' => 'array',
        'safety_features' => 'array',
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (HousingListing $listing): void {
            if (blank($listing->uuid)) {
                $listing->uuid = (string) Str::uuid();
            }

            static::ensureSlug($listing);
        });

        self::saving(function (HousingListing $listing): void {
            static::ensureSlug($listing);
        });
    }

    protected static function ensureSlug(HousingListing $listing): void
    {
        if (blank($listing->slug) && filled($listing->title)) {
            $listing->slug = Str::slug($listing->title);
        }

        if (filled($listing->slug)) {
            $listing->slug = self::uniqueSlug($listing->slug, $listing->id);
        }
    }

    protected static function uniqueSlug(string $slug, ?int $ignoreId = null): string
    {
        $base = Str::slug($slug) ?: 'housing';
        $unique = $base;
        $counter = 1;

        while (self::where('slug', $unique)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists()) {
            $unique = $base.'-'.$counter++;
        }

        return $unique;
    }

    public function organizationPage(): BelongsTo
    {
        return $this->belongsTo(OrganizationPage::class, 'org_page_id');
    }

    public function landlord(): BelongsTo
    {
        return $this->belongsTo(User::class, 'landlord_user_id');
    }
}
