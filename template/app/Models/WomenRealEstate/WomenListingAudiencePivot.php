<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Enums\WomenRealEstate\ListingAudience;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $listing_id
 * @property ListingAudience $audience
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenRealEstate\WomenListing $listing
 * @method static \Database\Factories\WomenRealEstate\WomenListingAudiencePivotFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingAudiencePivot newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingAudiencePivot newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingAudiencePivot query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingAudiencePivot whereAudience($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingAudiencePivot whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingAudiencePivot whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingAudiencePivot whereListingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingAudiencePivot whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WomenListingAudiencePivot extends Model
{
    use HasFactory;

    protected $table = 'women_listing_audience_pivots';

    protected $fillable = [
        'listing_id',
        'audience',
    ];

    protected $casts = [
        'audience' => ListingAudience::class,
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(WomenListing::class, 'listing_id');
    }
}

