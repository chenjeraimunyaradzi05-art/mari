<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $listing_id
 * @property int|null $rate_id
 * @property numeric|null $deposit_required
 * @property numeric $principal_amount
 * @property numeric $comparison_rate
 * @property numeric $repayment_weekly
 * @property numeric $repayment_monthly
 * @property numeric $repayment_fortnightly
 * @property string $currency
 * @property array<array-key, mixed>|null $ai_commentary
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenRealEstate\WomenListing $listing
 * @property-read \App\Models\WomenRealEstate\WomenMortgageMarketRate|null $marketRate
 * @method static \Database\Factories\WomenRealEstate\WomenListingMortgageSnapshotFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot whereAiCommentary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot whereComparisonRate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot whereDepositRequired($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot whereListingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot wherePrincipalAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot whereRateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot whereRepaymentFortnightly($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot whereRepaymentMonthly($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot whereRepaymentWeekly($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingMortgageSnapshot whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WomenListingMortgageSnapshot extends Model
{
    use HasFactory;

    protected $table = 'women_listing_mortgage_snapshots';

    protected $fillable = [
        'listing_id',
        'rate_id',
        'deposit_required',
        'principal_amount',
        'comparison_rate',
        'repayment_weekly',
        'repayment_monthly',
        'repayment_fortnightly',
        'currency',
        'ai_commentary',
    ];

    protected $casts = [
        'deposit_required' => 'decimal:2',
        'principal_amount' => 'decimal:2',
        'comparison_rate' => 'decimal:3',
        'repayment_weekly' => 'decimal:2',
        'repayment_monthly' => 'decimal:2',
        'repayment_fortnightly' => 'decimal:2',
        'ai_commentary' => 'array',
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(WomenListing::class, 'listing_id');
    }

    public function marketRate(): BelongsTo
    {
        return $this->belongsTo(WomenMortgageMarketRate::class, 'rate_id');
    }
}

