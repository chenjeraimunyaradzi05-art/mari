<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int $owner_user_id
 * @property int|null $agent_profile_id
 * @property string $title
 * @property string $slug
 * @property string $listing_type
 * @property string|null $audience
 * @property string|null $description
 * @property int|null $price_cents
 * @property string $currency
 * @property int|null $bond_cents
 * @property bool $mortgage_required
 * @property array<array-key, mixed>|null $location
 * @property array<array-key, mixed>|null $amenities
 * @property \Illuminate\Support\Carbon|null $availability_date
 * @property string $verification_status
 * @property string $moderation_status
 * @property string $visibility
 * @property array<array-key, mixed>|null $ai_tags
 * @property float $ai_recommendation_score
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \App\Models\AgentProfile|null $agentProfile
 * @property-read \App\Models\ListingMortgageQuote|null $latestMortgageQuote
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ListingMortgageQuote> $mortgageQuotes
 * @property int|null mortgage_quotes_count
 * @property-read \App\Models\User $owner
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ListingPartnershipIntention> $partnershipIntentions
 * @property int|null partnership_intentions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenListingPhoto> $photos
 * @property int|null photos_count
 * @property-read \App\Models\WomenListingPhoto|null $primaryPhoto
 * @method static \Database\Factories\WomenHousingListingFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereAgentProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereAiRecommendationScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereAiTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereAmenities($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereAudience($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereAvailabilityDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereBondCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereListingType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereModerationStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereMortgageRequired($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereOwnerUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing wherePriceCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereUuid($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereVerificationStatus(final $value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing whereVisibility($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenHousingListing withoutTrashed()
 * @mixin \Eloquent
 */
final class WomenHousingListing extends Model
{
    use HasFactory;
    use SoftDeletes;

    // Guarded defaults to allow mass-assignment by fillable.
    protected $fillable = [
        'uuid',
        'owner_user_id',
        'agent_profile_id',
        'title',
        'slug',
        'listing_type',
        'audience',
        'description',
        'price_cents',
        'currency',
        'bond_cents',
        'mortgage_required',
        'location',
        'amenities',
        'availability_date',
        'verification_status',
        'moderation_status',
        'visibility',
        'ai_tags',
        'ai_recommendation_score',
    ];

    protected $casts = [
        'price_cents' => 'integer',
        'bond_cents' => 'integer',
        'mortgage_required' => 'boolean',
        'location' => 'array',
        'amenities' => 'array',
        'availability_date' => 'date',
        'ai_tags' => 'array',
        'ai_recommendation_score' => 'float',
    ];

    #[\Override]
    protected static function booted(): void
    {
        static::creating(function (WomenHousingListing $listing): void {
            if (empty($listing->uuid)) {
                $listing->uuid = (string) Str::uuid();
            }

            if (empty($listing->slug) && ! empty($listing->title)) {
                $listing->slug = Str::slug($listing->title) . '-' . Str::random(6);
            }
        });
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function agentProfile(): BelongsTo
    {
        return $this->belongsTo(AgentProfile::class, 'agent_profile_id');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(WomenListingPhoto::class, 'women_housing_listing_id')->orderBy('position');
    }

    public function primaryPhoto(): HasOne
    {
        return $this->hasOne(WomenListingPhoto::class, 'women_housing_listing_id')->where('is_primary', true);
    }

    public function partnershipIntentions(): HasMany
    {
        return $this->hasMany(ListingPartnershipIntention::class, 'women_housing_listing_id');
    }

    public function mortgageQuotes(): HasMany
    {
        return $this->hasMany(ListingMortgageQuote::class, 'women_housing_listing_id');
    }

    public function latestMortgageQuote(): HasOne
    {
        return $this->hasOne(ListingMortgageQuote::class, 'women_housing_listing_id')->latestOfMany('generated_at');
    }
}
