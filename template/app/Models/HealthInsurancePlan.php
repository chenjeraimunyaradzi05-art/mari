<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $provider_name
 * @property string $plan_name
 * @property numeric $monthly_premium
 * @property numeric $deductible
 * @property numeric $out_of_pocket_max
 * @property string $coverage_type
 * @property array<array-key, mixed>|null $features
 * @property numeric|null $rating
 * @property string|null $website_url
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan whereCoverageType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan whereDeductible($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan whereFeatures($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan whereMonthlyPremium($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan whereOutOfPocketMax($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan wherePlanName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan whereProviderName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan whereRating($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan whereUpdatedAt($value)
 *final  @method static \Illuminate\Database\Eloquent\Builder<static>|HealthInsurancePlan whereWebsiteUrl($value)
 *
 * @mixin \Eloquent
 */
final class HealthInsurancePlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'provider_name',
        'plan_name',
        'monthly_premium',
        'deductible',
        'out_of_pocket_max',
        'coverage_type',
        'features',
        'rating',
        'website_url',
    ];

    protected $casts = [
        'features' => 'array',
        'monthly_premium' => 'decimal:2',
        'deductible' => 'decimal:2',
        'out_of_pocket_max' => 'decimal:2',
        'rating' => 'decimal:1',
    ];
}
