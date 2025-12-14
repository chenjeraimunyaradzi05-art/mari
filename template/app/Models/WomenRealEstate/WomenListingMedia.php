<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $listing_id
 * @property string $type
 * @property string $path
 * @property string|null $caption
 * @property int $position
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenRealEstate\WomenListing $listing
 * @method static \Database\Factories\WomenRealEstate\WomenListingMediaFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMedia newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMedia newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMedia query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMedia whereCaption($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMedia whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMedia whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMedia whereListingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMedia whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMedia wherePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMedia wherePosition($value)
 final  * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMedia whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMedia whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WomenListingMedia extends Model
{
    use HasFactory;

    protected $table = 'women_listing_media';

    protected $fillable = [
        'listing_id',
        'type',
        'path',
        'caption',
        'position',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(WomenListing::class, 'listing_id');
    }
}
