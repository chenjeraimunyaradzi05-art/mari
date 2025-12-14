<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $bundle_offer_id
 * @property string $category
 * @property string|null $current_provider
 * @property numeric $current_monthly_cost
 * @property string|null $suggested_provider
 * @property numeric $suggested_monthly_cost
 * @property numeric $projected_savings_monthly
 * @property string|null $provider_connector
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\BundleOffer $bundleOffer
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem whereBundleOfferId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem whereCurrentMonthlyCost($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem whereCurrentProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem whereProjectedSavingsMonthly($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem whereProviderConnector($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem whereSuggestedMonthlyCost($value)
 * @method static \Illuminate\Database\Eloquent\Builder<staticfinal >|BundleOfferLineItem whereSuggestedProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BundleOfferLineItem whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class BundleOfferLineItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'bundle_offer_id',
        'category',
        'current_provider',
        'current_monthly_cost',
        'suggested_provider',
        'suggested_monthly_cost',
        'projected_savings_monthly',
        'provider_connector',
        'metadata',
    ];

    protected $casts = [
        'current_monthly_cost' => 'decimal:2',
        'suggested_monthly_cost' => 'decimal:2',
        'projected_savings_monthly' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function bundleOffer(): BelongsTo
    {
        return $this->belongsTo(BundleOffer::class);
    }
}
