<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Enums\WomenRealEstate\ListingAudience;
use App\Enums\WomenRealEstate\ListingIntent;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\WomenRealEstate\WomenUserMedia;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int $owner_id
 * @property int|null $agent_id
 * @property int|null $category_id
 * @property int|null $location_id
 * @property string $title
 * @property string $slug
 * @property ListingIntent $intent
 * @property ListingAudience $primary_audience
 * @property array<array-key, mixed>|null $audience_overrides
 * @property string $summary
 * @property string|null $description
 * @property string|null $owner_story
 * @property array<array-key, mixed>|null $safety_commitments
 * @property int|null $virtual_tour_media_id
 * @property array<array-key, mixed>|null $ai_listing_summary
 * @property array<array-key, mixed>|null $features
 * @property int|null $bedrooms
 * @property int|null $bathrooms
 * @property int|null $car_spaces
 * @property numeric|null $price
 * @property string|null $price_frequency
 * @property string $currency
 * @property bool $is_verified
 * @property numeric|null $trust_score
 * @property numeric|null $market_score
 * @property bool $published_via_social
 * @property \Illuminate\Support\Carbon|null $social_boosted_at
 * @property bool $is_ai_safe
 * @property array<array-key, mixed>|null $ai_insights
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenRealEstate\WomenVerifiedAgent|null $agent
 * @property-read mixed $audience_values
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenListingAudiencePivot> $audiences
 * @property int|null audiences_count
 * @property-read \App\Models\WomenRealEstate\WomenListingCategory|null $category
 * @property-read \App\Models\WomenRealEstate\WomenListingLocation|null $location
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenListingMedia> $media
 * @property int|null media_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenListingMortgageSnapshot> $mortgageSnapshots
 * @property int|null mortgage_snapshots_count
 * @property-read \App\Models\User $owner
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenListingPartnerIntention> $partnerIntentions
 * @property int|null partner_intentions_count
 * @property-read mixed $primary_media
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenListingSocialShare> $socialShares
 * @property int|null social_shares_count
 * @property-read mixed $title_excerpt
 * @property-read WomenUserMedia|null $virtualTourMedia
 * @method static \Database\Factories\WomenRealEstate\WomenListingFactory factory($count = null, $state = [])
 * @method static Builder<static>|WomenListing forAudience(array|string $audiences)
 * @method static Builder<static>|WomenListing newModelQuery()
 * @method static Builder<static>|WomenListing newQuery()
 * @method static Builder<static>|WomenListing published()
 * @method static Builder<static>|WomenListing query()
 * @method static Builder<static>|WomenListing socialBoosted()
 * @method static Builder<static>|WomenListing whereAgentId($value)
 * @method static Builder<static>|WomenListing whereAiInsights($value)
 * @method static Builder<static>|WomenListing whereAiListingSummary($value)
 * @method static Builder<static>|WomenListing whereAudienceOverrides($value)
 * @method static Builder<static>|WomenListing whereBathrooms($value)
 * @method static Builder<static>|WomenListing whereBedrooms($value)
 * @method static Builder<static>|WomenListing whereCarSpaces($value)
 * @method static Builder<static>|WomenListing whereCategoryId($value)
 * @method static Builder<static>|WomenListing whereCreatedAt($value)
 * @method static Builder<static>|WomenListing whereCurrency($value)
 * @method static Builder<static>|WomenListing whereDescription($value)
 * @method static Builder<static>|WomenListing whereExpiresAt($value)
 * @method static Builder<static>|WomenListing whereFeatures($value)
 * @method static Builder<static>|WomenListing whereId($value)
 * @method static Builder<static>|WomenListing whereIntent($value)
 * @method static Builder<static>|WomenListing whereIsAiSafe($value)
 * @method static Builder<static>|WomenListing whereIsVerified($value)
 * @method static Builder<static>|WomenListing whereLocationId($value)
 * @method static Builder<static>|WomenListing whereMarketScore($value)
 * @method static Builder<static>|WomenListing whereOwnerId($value)
 * @method static Builder<static>|WomenListing whereOwnerStory($value)
 * @method static Builder<static>|WomenListing wherePrice($value)
 * @method static Builder<static>|WomenListing wherePriceFrequency($value)
 * @method static Builder<static>|WomenListing wherePrimaryAudience($value)
 * @method static Builder<static>|WomenListing wherePublishedAt($value)
 * @method static Builder<static>|WomenListing wherePublishedViaSocial($value)
 * @method static Builder<static>|WomenListing whereSafetyCommitments($value)
 * @method static Builder<static>|WomenListing whereSlug($value)
 * @method static Builder<static>|WomenListing whereSocialBoostedAt($value)
 * @method static Builder<static>|WomenListing whereSummary($value)
 * @method static Builder<static>|WomenListing whereTitle($value)
 * @method static Builder<static>|WomenListing whereTrustScore($value)
 * @method static Builder<static>|WomenListing whereUpdatedAt($value)
 * @method static Builder<static>|WomenListing whereUuid($value)
 * @method static Builder<static>|WomenListing whereVirtualTourMediaId($value)
 * @mixin \Eloquent
 */
final class WomenListing extends Model
{
    use HasFactory;

    protected $table = 'women_listings';

    protected $fillable = [
        'uuid',
        'owner_id',
        'agent_id',
        'category_id',
        'location_id',
        'title',
        'slug',
        'intent',
        'primary_audience',
        'audience_overrides',
        'summary',
        'description',
        'owner_story',
        'features',
        'bedrooms',
        'bathrooms',
        'car_spaces',
        'safety_commitments',
        'price',
        'price_frequency',
        'currency',
        'is_verified',
        'is_ai_safe',
        'trust_score',
        'market_score',
        'published_via_social',
        'social_boosted_at',
        'ai_insights',
        'ai_listing_summary',
        'virtual_tour_media_id',
        'published_at',
        'expires_at',
    ];

    protected $casts = [
        'intent' => ListingIntent::class,
        'primary_audience' => ListingAudience::class,
        'audience_overrides' => 'array',
        'features' => 'array',
        'safety_commitments' => 'array',
        'is_verified' => 'bool',
        'is_ai_safe' => 'bool',
        'trust_score' => 'decimal:2',
        'market_score' => 'decimal:2',
        'published_via_social' => 'bool',
        'social_boosted_at' => 'datetime',
        'ai_insights' => 'array',
        'ai_listing_summary' => 'array',
        'published_at' => 'datetime',
        'expires_at' => 'datetime',
        'price' => 'decimal:2',
    ];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (WomenListing $listing): void {
            if (empty($listing->uuid)) {
                $listing->uuid = (string) Str::uuid();
            }

            if (empty($listing->slug)) {
                $listing->slug = Str::slug(Str::limit($listing->title ?? Str::uuid(), 64, ''));
            }
        });
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(related: \App\Models\User::class, foreignKey: 'owner_id');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(related: WomenVerifiedAgent::class, foreignKey: 'agent_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(related: WomenListingCategory::class, foreignKey: 'category_id');
    }

    public function virtualTourMedia(): BelongsTo
    {
        return $this->belongsTo(WomenUserMedia::class, 'virtual_tour_media_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(related: WomenListingLocation::class, foreignKey: 'location_id');
    }

    public function media(): HasMany
    {
        return $this->hasMany(WomenListingMedia::class, 'listing_id')->orderBy('position');
    }

    public function audiences(): HasMany
    {
        return $this->hasMany(WomenListingAudiencePivot::class, 'listing_id');
    }

    protected function audienceValues(): Attribute
    {
        // Collect the audience enums directly from the pivot records for downstream consumers.
        return Attribute::make(
            get: fn () => $this->audiences
                ->map(static fn (WomenListingAudiencePivot $pivot) => $pivot->audience)
        );
    }

    public function mortgageSnapshots(): HasMany
    {
        return $this->hasMany(WomenListingMortgageSnapshot::class, 'listing_id');
    }

    public function socialShares(): HasMany
    {
        return $this->hasMany(WomenListingSocialShare::class, 'listing_id')->orderByDesc('shared_at');
    }

    public function partnerIntentions(): HasMany
    {
        return $this->hasMany(WomenListingPartnerIntention::class, 'listing_id')->latest();
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeSocialBoosted(Builder $query): Builder
    {
        return $query->where('published_via_social', true);
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->whereNotNull('published_at')
            ->where('published_at', '<=', now())
            ->where(function (Builder $inner): void {
                $inner->whereNull('expires_at')
                    ->orWhere('expires_at', '>=', now());
            });
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeForAudience(Builder $query, string|array $audiences): Builder
    {
        $audiences = Arr::wrap($audiences);

        return $query->where(function (Builder $builder) use ($audiences): void {
            $builder->whereIn('primary_audience', $audiences)
                ->orWhere(function (Builder $sub) use ($audiences): void {
                    foreach ($audiences as $audience) {
                        $sub->orWhereJsonContains('audience_overrides', $audience);
                    }
                })
                ->orWhereHas('audiences', function (Builder $builder) use ($audiences): void {
                    $builder->whereIn('audience', $audiences);
                });
        });
    }

    public function primaryMedia(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->media->first()
        );
    }

    public function titleExcerpt(): Attribute
    {
        return Attribute::make(
            get: fn () => Str::limit($this->title, 80)
        );
    }
}

