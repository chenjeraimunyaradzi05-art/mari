<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int $women_housing_listing_id
 * @property string $storage_path
 * @property string|null $cdn_url
 * @property string|null $caption
 * @property int $position
 * @property bool $is_primary
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read string $url
 * @property-read \App\Models\WomenHousingListing $listing
 * @method static \Database\Factories\WomenListingPhotoFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPhoto newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPhoto newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPhoto query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPhoto whereCaption($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPhoto whereCdnUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPhoto whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPhoto whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPhoto whereIsPrimary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPhoto whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPhoto wherePosition($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPhoto whereStoragePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPhoto whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPhoto whereWomenHousingListingId($value)
 * @mixin \Eloquent
 */
final class WomenListingPhoto extends Model
{
    use HasFactory;

    protected $fillable = [
        'women_housing_listing_id',
        'storage_path',
        'cdn_url',
        'caption',
        'position',
        'is_primary',
        'meta',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'meta' => 'array',
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(WomenHousingListing::class, 'women_housing_listing_id');
    }

    public function getUrlAttribute(): string
    {
        if ($this->cdn_url) {
            return $this->cdn_url;
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $storage */
        $storage = Storage::disk('public');

        return $storage->url($this->storage_path);
    }
}

