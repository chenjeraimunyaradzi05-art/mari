<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $women_housing_listing_id
 * @property int|null $user_id
 * @property int $mortgage_rate_snapshot_id
 * @property int $principal_amount_cents
 * @property int|null $deposit_amount_cents
 * @property int $loan_term_months
 * @property string $repayment_frequency
 * @property int $calculated_repayment_cents
 * @property string|null $risk_rating
 * @property string|null $ai_commentary
 * @property \Illuminate\Support\Carbon $generated_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenHousingListing $listing
 * @property-read \App\Models\MortgageRateSnapshot $rateSnapshot
 * @property-read \App\Models\User|null $user
 *
 * @method static \Database\Factories\ListingMortgageQuoteFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote whereAiCommentary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote whereCalculatedRepaymentCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote whereDepositAmountCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote whereGeneratedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote whereLoanTermMonths($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote whereMortgageRateSnapshotId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote wherePrincipalAmountCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote whereRepaymentFrequency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote whereRiskRating($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ListingMortgageQuote whereWomenHousingListingId($value)
 *
 * @mixin \Eloquent
 */
final class ListingMortgageQuote extends Model
{
    use HasFactory;

    protected $fillable = [
        'women_housing_listing_id',
        'user_id',
        'mortgage_rate_snapshot_id',
        'principal_amount_cents',
        'deposit_amount_cents',
        'loan_term_months',
        'repayment_frequency',
        'calculated_repayment_cents',
        'risk_rating',
        'ai_commentary',
        'generated_at',
    ];

    protected $casts = [
        'principal_amount_cents' => 'integer',
        'deposit_amount_cents' => 'integer',
        'loan_term_months' => 'integer',
        'calculated_repayment_cents' => 'integer',
        'generated_at' => 'datetime',
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(WomenHousingListing::class, 'women_housing_listing_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function rateSnapshot(): BelongsTo
    {
        return $this->belongsTo(MortgageRateSnapshot::class, 'mortgage_rate_snapshot_id');
    }
}
