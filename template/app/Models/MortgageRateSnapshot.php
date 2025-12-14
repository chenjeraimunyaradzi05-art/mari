<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $provider
 * @property string $product_name
 * @property string $rate_type
 * @property int $term_months
 * @property float $interest_rate
 * @property float|null $comparison_rate
 * @property float|null $apr
 * @property int|null $max_lvr
 * @property int|null $min_deposit_percent
 * @property string $available_to
 * @property string $market_region
 * @property array<array-key, mixed>|null $feature_flags
 * @property \Illuminate\Support\Carbon|null $captured_at
 * @property string|null $source
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ListingMortgageQuote> $listingQuotes
 * @property int|null listing_quotes_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot availableTo(string $audience)
 * @method static \Database\Factories\MortgageRateSnapshotFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot forRegion(string $region)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereApr($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereAvailableTo($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereCapturedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereComparisonRate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereFeatureFlags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereInterestRate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereMarketRegion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereMaxLvr($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereMinDepositPercent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereProductName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereRateType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereTermMonths($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MortgageRateSnapshot whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class MortgageRateSnapshot extends Model
{
    use HasFactory;

    protected $fillable = [
        'provider',
        'product_name',
        'rate_type',
        'term_months',
        'interest_rate',
        'comparison_rate',
        'apr',
        'max_lvr',
        'min_deposit_percent',
        'available_to',
        'market_region',
        'feature_flags',
        'captured_at',
        'source',
    ];

    protected $casts = [
        'feature_flags' => 'array',
        'captured_at' => 'datetime',
        'interest_rate' => 'float',
        'comparison_rate' => 'float',
        'apr' => 'float',
    ];

    public function listingQuotes(): HasMany
    {
        return $this->hasMany(ListingMortgageQuote::class, 'mortgage_rate_snapshot_id');
    }

    public function scopeForRegion($query, string $region)
    {
        return $query->where('market_region', $region);
    }

    public function scopeAvailableTo($query, string $audience)
    {
        return $query->where('available_to', $audience);
    }
}
