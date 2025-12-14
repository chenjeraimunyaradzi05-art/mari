<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $listing_id
 * @property int $landlord_user_id
 * @property numeric $monthly_rent Monthly rental price
 * @property numeric|null $security_deposit
 * @property string $furnishing
 * @property string $lease_term
 * @property int $min_lease_months
 * @property int|null $max_lease_months
 * @property \Illuminate\Support\Carbon $available_from
 * @property \Illuminate\Support\Carbon|null $available_until
 * @property array<array-key, mixed>|null $ai_preferences
 * @property string|null $house_rules
 * @property bool $allows_pets
 * @property bool $allows_smoking
 * @property bool $allows_visitors
 * @property int|null $max_occupants
 * @property array<array-key, mixed>|null $utilities_included
 * @property int $views_count
 * @property int $inquiry_count
 * @property string|null $avg_rating
 * @property bool $is_active
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenPropertyMatch> $aiMatches
 * @property int|null ai_matches_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenRentalInquiry> $inquiries
 * @property int|null inquiries_count
 * @property-read User $landlord
 * @property-read \App\Models\WomenRealEstate\WomenListing $listing
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereAiPreferences($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereAllowsPets($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereAllowsSmoking($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereAllowsVisitors($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereAvailableFrom($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereAvailableUntil($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereAvgRating($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereFurnishing($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereHouseRules($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereInquiryCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereLandlordUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereLeaseTerm($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereListingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereMaxLeaseMonths($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereMaxOccupants($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereMinLeaseMonths($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereMonthlyRent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereSecurityDeposit($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereUtilitiesIncluded($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty whereViewsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalProperty withoutTrashed()
 * @mixin \Eloquent
 */
final class WomenRentalProperty extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'women_rental_properties';

    protected $fillable = [
        'listing_id',
        'landlord_user_id',
        'monthly_rent',
        'security_deposit',
        'furnishing',
        'lease_term',
        'min_lease_months',
        'max_lease_months',
        'available_from',
        'available_until',
        'ai_preferences',
        'house_rules',
        'allows_pets',
        'allows_smoking',
        'allows_visitors',
        'max_occupants',
        'utilities_included',
        'views_count',
        'inquiry_count',
        'avg_rating',
        'is_active',
    ];

    protected $casts = [
        'monthly_rent' => 'decimal:2',
        'security_deposit' => 'decimal:2',
        'ai_preferences' => 'json',
        'allows_pets' => 'boolean',
        'allows_smoking' => 'boolean',
        'allows_visitors' => 'boolean',
        'utilities_included' => 'json',
        'available_from' => 'date',
        'available_until' => 'date',
        'is_active' => 'boolean',
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(WomenListing::class);
    }

    public function landlord(): BelongsTo
    {
        return $this->belongsTo(User::class, 'landlord_user_id');
    }

    public function inquiries(): HasMany
    {
        return $this->hasMany(WomenRentalInquiry::class);
    }

    public function aiMatches(): HasMany
    {
        return $this->hasMany(WomenPropertyMatch::class, 'rental_property_id');
    }
}

