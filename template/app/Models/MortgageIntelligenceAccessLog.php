<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int|null $user_id
 * @property int $women_housing_listing_id
 * @property string $channel
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon $accessed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenHousingListing $listing
 * @property-read \App\Models\User|null $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageIntelligenceAccessLog newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageIntelligenceAccessLog newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageIntelligenceAccessLog query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageIntelligenceAccessLog whereAccessedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageIntelligenceAccessLog whereChannel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageIntelligenceAccessLog whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageIntelligenceAccessLog whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageIntelligenceAccessLog whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageIntelligenceAccessLog whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builderfinal <static>|MortgageIntelligenceAccessLog whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageIntelligenceAccessLog whereWomenHousingListingId($value)
 *
 * @mixin \Eloquent
 */
final class MortgageIntelligenceAccessLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'women_housing_listing_id',
        'channel',
        'meta',
        'accessed_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'accessed_at' => 'datetime',
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(WomenHousingListing::class, 'women_housing_listing_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
