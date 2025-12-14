<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string|null $description
 * @property string|null $icon
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenListing> $listings
 * @property int|null listings_count
 * @method static \Database\Factories\WomenRealEstate\WomenListingCategoryFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingCategory newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingCategory newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingCategory query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingCategory whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingCategory whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingCategory whereIcon($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingCategory whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingCategory whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingCategory whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingCategory whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WomenListingCategory extends Model
{
    use HasFactory;

    protected $table = 'women_listing_categories';

    protected $fillable = [
        'slug',
        'name',
        'description',
        'icon',
    ];

    public function listings(): HasMany
    {
        return $this->hasMany(WomenListing::class, 'category_id');
    }
}

