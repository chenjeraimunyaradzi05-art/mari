<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string $bundle_code
 * @property string $status
 * @property string $currency
 * @property numeric $baseline_monthly_cost
 * @property numeric $projected_monthly_cost
 * @property numeric $projected_savings_monthly
 * @property numeric $projected_savings_annual
 * @property numeric $confidence
 * @property array<array-key, mixed>|null $recommendations
 * @property array<array-key, mixed>|null $impact_projection
 * @property array<array-key, mixed>|null $success_tracking
 * @property string|null $negotiation_script
 * @property string|null $referral_code
 * @property array<array-key, mixed>|null $provider_payload
 * @property \Illuminate\Support\Carbon|null $referred_at
 * @property \Illuminate\Support\Carbon|null $activated_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\BundleOfferLineItem> $lineItems
 * @property int|null line_items_count
 * @property-read \App\Models\User|null $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer forUser(int $userId)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereActivatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereBaselineMonthlyCost($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereBundleCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereConfidence($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereImpactProjection($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereNegotiationScript($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereProjectedMonthlyCost($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereProjectedSavingsAnnual($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereProjectedSavingsMonthly($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereProviderPayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereRecommendations($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereReferralCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereReferredAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereSuccessTracking($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOffer whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class BundleOffer extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'bundle_code',
        'status',
        'currency',
        'baseline_monthly_cost',
        'projected_monthly_cost',
        'projected_savings_monthly',
        'projected_savings_annual',
        'confidence',
        'recommendations',
        'impact_projection',
        'success_tracking',
        'negotiation_script',
        'referral_code',
        'provider_payload',
        'referred_at',
        'activated_at',
    ];

    protected $casts = [
        'baseline_monthly_cost' => 'decimal:2',
        'projected_monthly_cost' => 'decimal:2',
        'projected_savings_monthly' => 'decimal:2',
        'projected_savings_annual' => 'decimal:2',
        'confidence' => 'decimal:2',
        'recommendations' => 'array',
        'impact_projection' => 'array',
        'success_tracking' => 'array',
        'provider_payload' => 'array',
        'referred_at' => 'datetime',
        'activated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function lineItems(): HasMany
    {
        return $this->hasMany(BundleOfferLineItem::class);
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }
}
