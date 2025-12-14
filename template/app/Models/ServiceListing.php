<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property string $name
 * @property string $slug
 * @property int|null $user_id
 * @property int|null $org_page_id
 * @property string $category
 * @property string|null $city
 * @property string|null $state
 * @property string $country
 * @property string|null $location_slug
 * @property string|null $description
 * @property array<array-key, mixed>|null $modalities
 * @property array<array-key, mixed>|null $availability_options
 * @property array<array-key, mixed>|null $perks
 * @property array<array-key, mixed>|null $tags
 * @property string|null $hero_image
 * @property string|null $price_tier
 * @property string|null $price_copy
 * @property string|null $booking_cta
 * @property numeric|null $rating
 * @property int $review_count
 * @property bool $is_sponsored
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property \Illuminate\Support\Carbon|null $featured_until
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ServiceListingLead> $leads
 * @property int|null leads_count
 * @property-read mixed $location_label
 * @property-read \App\Models\OrganizationPage|null $orgPage
 * @property-read \App\Models\User|null $owner
 * @method static \Database\Factories\ServiceListingFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing published()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereAvailabilityOptions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereBookingCta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereCity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereCountry($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereFeaturedUntil($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereHeroImage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereIsSponsored($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereLocationSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereModalities($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereOrgPageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing wherePerks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing wherePriceCopy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing wherePriceTier($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereRating($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereReviewCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereState($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing whereUuid($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListing withoutTrashed()
 * @mixin \Eloquent
 */
final class ServiceListing extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'name',
        'slug',
        'user_id',
        'org_page_id',
        'category',
        'city',
        'state',
        'country',
        'location_slug',
        'description',
        'modalities',
        'availability_options',
        'perks',
        'tags',
        'hero_image',
        'price_tier',
        'price_copy',
        'booking_cta',
        'rating',
        'review_count',
        'is_sponsored',
        'published_at',
        'featured_until',
        'metadata',
    ];

    protected $casts = [
        'modalities' => 'array',
        'availability_options' => 'array',
        'perks' => 'array',
        'tags' => 'array',
        'metadata' => 'array',
        'is_sponsored' => 'bool',
        'rating' => 'decimal:2',
        'published_at' => 'datetime',
        'featured_until' => 'datetime',
    ];

    #[\Override]
    protected static function booted(): void
    {
        static::creating(function (self $listing): void {
            if (empty($listing->uuid)) {
                $listing->uuid = (string) Str::uuid();
            }

            if (empty($listing->slug)) {
                $listing->slug = Str::slug($listing->name);
            }
        });
    }

    public function scopePublished($query)
    {
        return $query->whereNotNull('published_at')->where('published_at', '<=', now());
    }

    public function leads(): HasMany
    {
        return $this->hasMany(ServiceListingLead::class);
    }

    public function orgPage(): BelongsTo
    {
        return $this->belongsTo(OrganizationPage::class, 'org_page_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return string
     *
     * @psalm-return 'slug'
     */
    #[\Override]
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function categoryLabel(): string
    {
        $categoryConfig = config("women_marketplace.categories.{$this->category}");

        return $categoryConfig['label'] ?? Str::title(str_replace('_', ' ', (string) $this->category));
    }

    protected function locationLabel(): Attribute
    {
        return Attribute::get(function () {
            if (! $this->city && ! $this->state) {
                return null;
            }

            return trim(sprintf('%s, %s', $this->city, $this->state));
        });
    }
}

