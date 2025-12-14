<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int|null $parent_id
 * @property string $name
 * @property string $slug
 * @property string $type
 * @property numeric|null $latitude
 * @property numeric|null $longitude
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, WomenListingLocation> $children
 * @property int|null children_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenListing> $listings
 * @property int|null listings_count
 * @property-read WomenListingLocation|null $parent
 * @method static \Database\Factories\WomenRealEstate\WomenListingLocationFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingLocation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingLocation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingLocation query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingLocation whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingLocation whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingLocation whereLatitude($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingLocation whereLongitude($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingLocation whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingLocation whereParentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingLocation whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingLocation whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingLocation whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WomenListingLocation extends Model
{
    use HasFactory;

    protected $table = 'women_listing_locations';

    protected $fillable = [
        'parent_id',
        'name',
        'slug',
        'type',
        'latitude',
        'longitude',
    ];

    protected $casts = [
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function listings(): HasMany
    {
        return $this->hasMany(WomenListing::class, 'location_id');
    }
}

