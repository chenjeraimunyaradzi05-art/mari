<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string|null $license_number
 * @property string|null $address
 * @property string $contact_email
 * @property string|null $contact_phone
 * @property bool $is_verified
 * @property string|null $logo_url
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property bool $offers_warranty
 * @property bool $has_certified_pre_owned
 * @property bool $is_dealer_approved
 * @property numeric|null $rating
 * @property array<array-key, mixed>|null $specialties
 * @property array<array-key, mixed>|null $operating_hours
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\VehicleInquiry> $inquiries
 * @property int|null inquiries_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\VehicleListing> $listings
 * @property int|null listings_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereAddress($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereContactEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereContactPhone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereHasCertifiedPreOwned($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereIsDealerApproved($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereIsVerified($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereLicenseNumber($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereLogoUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereOffersWarranty($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereOperatingHours($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereRating($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereSpecialties($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Dealer whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class Dealer extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'license_number',
        'address',
        'contact_email',
        'contact_phone',
        'is_verified',
        'logo_url',
        'offers_warranty',
        'has_certified_pre_owned',
        'is_dealer_approved',
        'rating',
        'specialties',
        'operating_hours',
    ];

    protected $casts = [
        'is_verified' => 'boolean',
        'offers_warranty' => 'boolean',
        'has_certified_pre_owned' => 'boolean',
        'is_dealer_approved' => 'boolean',
        'specialties' => 'array',
        'operating_hours' => 'array',
        'rating' => 'decimal:2',
    ];

    public function listings(): HasMany
    {
        return $this->hasMany(VehicleListing::class);
    }

    public function inquiries(): HasMany
    {
        return $this->hasMany(VehicleInquiry::class);
    }
}
