<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenPersonaProfile;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $user_id
 * @property string $seeker_type
 * @property array<array-key, mixed>|null $location_preferences
 * @property array<array-key, mixed>|null $property_type_preferences
 * @property numeric|null $min_budget
 * @property numeric|null $max_budget
 * @property int|null $min_bedrooms
 * @property int|null $max_bedrooms
 * @property int|null $min_bathrooms
 * @property int|null $max_bathrooms
 * @property string|null $min_area
 * @property string|null $max_area
 * @property array<array-key, mixed>|null $must_have_features
 * @property array<array-key, mixed>|null $nice_to_have_features
 * @property string $furnishing_preference
 * @property bool|null $allows_pets
 * @property bool $needs_parking
 * @property int|null $preferred_move_in_days
 * @property int|null $financial_confidence
 * @property string $mortgage_preapproval_status
 * @property array<array-key, mixed>|null $property_goals
 * @property array<array-key, mixed>|null $lifestyle_preferences
 * @property array<array-key, mixed>|null $ai_profile
 * @property array<array-key, mixed>|null $match_history
 * @property int $profile_completion_percentage
 * @property int $total_views_received
 * @property int $total_matches_found
 * @property int $inquiries_sent
 * @property bool $is_active
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenSocialNetworkConnection> $connections
 * @property int|null connections_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenRentalInquiry> $inquiries
 * @property int|null inquiries_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenPropertyMatch> $matches
 * @property int|null matches_count
 * @property-read WomenPersonaProfile $personaProfile
 * @property-read User $user
 * @method static \Database\Factories\WomenRealEstate\WomenPropertySeekerFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereAiProfile($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereAllowsPets($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereFinancialConfidence($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereFurnishingPreference($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereInquiriesSent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereLifestylePreferences($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereLocationPreferences($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereMatchHistory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereMaxArea($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereMaxBathrooms($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereMaxBedrooms($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereMaxBudget($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereMinArea($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereMinBathrooms($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereMinBedrooms($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereMinBudget($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereMortgagePreapprovalStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereMustHaveFeatures($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereNeedsParking($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereNiceToHaveFeatures($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker wherePreferredMoveInDays($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereProfileCompletionPercentage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker wherePropertyGoals($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker wherePropertyTypePreferences($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereSeekerType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereTotalMatchesFound($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereTotalViewsReceived($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertySeeker withoutTrashed()
 * @mixin \Eloquent
 */
final class WomenPropertySeeker extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'women_property_seekers';

    protected $fillable = [
        'user_id',
        'seeker_type',
        'location_preferences',
        'property_type_preferences',
        'min_budget',
        'max_budget',
        'min_bedrooms',
        'max_bedrooms',
        'min_bathrooms',
        'max_bathrooms',
        'min_area',
        'max_area',
        'must_have_features',
        'nice_to_have_features',
        'furnishing_preference',
        'allows_pets',
        'needs_parking',
        'preferred_move_in_days',
        'financial_confidence',
        'mortgage_preapproval_status',
        'property_goals',
        'lifestyle_preferences',
        'ai_profile',
        'match_history',
        'profile_completion_percentage',
        'total_views_received',
        'total_matches_found',
        'inquiries_sent',
        'is_active',
    ];

    protected $casts = [
        'location_preferences' => 'json',
        'property_type_preferences' => 'json',
        'min_budget' => 'decimal:2',
        'max_budget' => 'decimal:2',
        'must_have_features' => 'json',
        'nice_to_have_features' => 'json',
        'lifestyle_preferences' => 'json',
        'property_goals' => 'array',
        'ai_profile' => 'json',
        'match_history' => 'json',
        'allows_pets' => 'boolean',
        'needs_parking' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function personaProfile(): BelongsTo
    {
        return $this->belongsTo(WomenPersonaProfile::class, 'user_id', 'user_id')
            ->where('persona', WomenPersonaProfile::PERSONA_HOUSEHUNTER);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function matches(): HasMany
    {
        return $this->hasMany(WomenPropertyMatch::class);
    }

    public function inquiries(): HasMany
    {
        return $this->hasMany(WomenRentalInquiry::class);
    }

    public function connections(): HasMany
    {
        return $this->hasMany(WomenSocialNetworkConnection::class, 'user_id_1', 'user_id')
            ->orWhere('user_id_2', '=', $this->user_id);
    }
}

