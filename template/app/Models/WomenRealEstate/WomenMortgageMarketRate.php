<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Enums\WomenRealEstate\MortgageRateSource;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property MortgageRateSource $source
 * @property string|null $provider
 * @property string $product_name
 * @property numeric $comparison_rate
 * @property numeric|null $variable_rate
 * @property numeric|null $fixed_rate
 * @property int|null $fixed_term_years
 * @property string $loan_type
 * @property string $repayment_type
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon $effective_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenListingMortgageSnapshot> $snapshots
 * @property int|null snapshots_count
 * @method static \Database\Factories\WomenRealEstate\WomenMortgageMarketRateFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereComparisonRate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereEffectiveAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereFixedRate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereFixedTermYears($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereLoanType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereProductName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereRepaymentType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenMortgageMarketRate whereVariableRate($value)
 * @mixin \Eloquent
 */
final class WomenMortgageMarketRate extends Model
{
    use HasFactory;

    protected $table = 'women_mortgage_market_rates';

    protected $fillable = [
        'source',
        'provider',
        'product_name',
        'comparison_rate',
        'variable_rate',
        'fixed_rate',
        'fixed_term_years',
        'loan_type',
        'repayment_type',
        'meta',
        'effective_at',
    ];

    protected $casts = [
        'source' => MortgageRateSource::class,
        'comparison_rate' => 'decimal:3',
        'variable_rate' => 'decimal:3',
        'fixed_rate' => 'decimal:3',
        'meta' => 'array',
        'effective_at' => 'datetime',
    ];

    public function snapshots(): HasMany
    {
        return $this->hasMany(WomenListingMortgageSnapshot::class, 'rate_id');
    }
}

