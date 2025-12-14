<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Auth;

/**
 * Property Model
 *
 * @property int $id
 * @property int $user_type
 * @property int|null $admin_id
 * @property int|null $user_id
 * @property int $property_type_id
 * @property int $city_id
 * @property int|null $listing_package_id
 * @property int $property_purpose_id
 * @property string $slug
 * @property int $views
 * @property string|null $phone
 * @property string|null $email
 * @property string|null $website
 * @property string|null $short_description
 * @property string|null $pdf_file
 * @property string|null $thumbnail_image
 * @property string|null $banner_image
 * @property int|null $number_of_unit
 * @property int|null $number_of_room
 * @property int|null $number_of_bedroom
 * @property int|null $number_of_bathroom
 * @property int|null $number_of_floor
 * @property int|null $number_of_kitchen
 * @property int|null $number_of_parking
 * @property string|null $area
 * @property float|null $price
 * @property string|null $period
 * @property string|null $video_link
 * @property int $is_featured
 * @property int $verified
 * @property int $status
 * @property string|null $seo_title
 * @property string|null $seo_description
 * @property string|null $google_map_embed_code
 * @property string|null $expired_date
 * @property int $is_popular
 * @property int $urgent_property
 * @property int $top_property
 * @property-read \App\Models\PropertyTranslation $translation
 * @property-read \Illuminate\Database\Eloquent\Collection $translations
 * @property-read \App\Models\PropertyType $propertyType
 * @property-read \App\Models\PropertyPurpose $propertyPurpose
 * @property-read \Illuminate\Database\Eloquent\Collection $propertyAminities
 * @property-read \Illuminate\Database\Eloquent\Collection $propertyImages
 * @property-read \Illuminate\Database\Eloquent\Collection $propertyNearestLocations
 *
 * @method bool save(array $options = [])
 * @method bool update(array $attributes = [], array $options = [])
 *
 * @property-read Admin|null $admin
 * @property-read City|null $city
 * @property-read string|null $banner_image_url
 * @property-read string|null $thumbnail_image_url
 * @property-read string|null $title
 * @property int|null property_aminities_count
 * @property int|null property_images_count
 * @property int|null property_nearest_locations_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PropertyReview> $reviews
 * @property int|null reviews_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PropertySocialPost> $socialPosts
 * @property int|null social_posts_count
 * @property int|null translations_count
 * @property-read User|null $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Property newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Property newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Property query()
 *
 * @property-read WishList|null $wishlist
 *
 * @mixin \Eloquent
 */
final class Property extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_type',
        'admin_id',
        'user_id',
        'property_type_id',
        'city_id',
        'listing_package_id',
        'property_purpose_id',
        'slug',
        'views',
        'phone',
        'email',
        'website',
        'short_description',
        'pdf_file',
        'thumbnail_image',
        'banner_image',
        'number_of_unit',
        'number_of_room',
        'number_of_bedroom',
        'number_of_bathroom',
        'number_of_floor',
        'number_of_kitchen',
        'number_of_parking',
        'area',
        'price',
        'period',
        'video_link',
        'is_featured',
        'verified',
        'status',
        'seo_title',
        'seo_description',
        'is_popular',
        'google_map_embed_code',
        'urgent_property',
        'top_property',
        'expired_date',
    ];

    public function getTitleAttribute(): string
    {
        return $this->translation->title;
    }

    public function translation(): ?HasOne
    {
        return $this->hasOne(PropertyTranslation::class)->where('lang_code', getSessionLanguage());
    }

    public function getTranslation($code): ?PropertyTranslation
    {
        return $this->hasOne(PropertyTranslation::class)->where('lang_code', $code)->first();
    }

    public function translations(): ?HasMany
    {
        return $this->hasMany(PropertyTranslation::class, 'property_id');
    }

    public function propertyType()
    {
        return $this->belongsTo(PropertyType::class)->with('translation');
    }

    public function propertyPurpose()
    {
        return $this->belongsTo(PropertyPurpose::class)->with('translation');
    }

    public function propertyAminities()
    {
        return $this->belongsToMany(Aminity::class, 'property_aminities');
    }

    public function propertyImages()
    {
        return $this->hasMany(PropertyImage::class);
    }

    public function propertyNearestLocations()
    {
        return $this->hasMany(PropertyNearestLocation::class)->with('nearestLocation');
    }

    public function city()
    {
        return $this->belongsTo(City::class);
    }

    public function admin()
    {
        return $this->belongsTo(Admin::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reviews()
    {
        return $this->hasMany(PropertyReview::class);
    }

    public function wishlist(): ?HasOne
    {
        $user = Auth::guard('web')->user();

        if (Auth::guard('web')->check()) {
            return $this->hasOne(WishList::class, 'property_id')->where(['user_id' => $user->id]);
        } else {
            return $this->hasOne(WishList::class, 'property_id');
        }
    }

    public function getThumbnailImageUrlAttribute(): string
    {
        if ($this->thumbnail_image) {
            return asset($this->thumbnail_image);
        }

        return asset('backend/img/no-image.png');
    }

    public function getBannerImageUrlAttribute(): string
    {
        if ($this->banner_image) {
            return asset($this->banner_image);
        }

        return asset('backend/img/no-image.png');
    }

    /**
     * Relationship: Property Social Posts
     * Get all social media shares for this property
     */
    public function socialPosts()
    {
        return $this->hasMany(PropertySocialPost::class, 'property_id', 'id');
    }
}
