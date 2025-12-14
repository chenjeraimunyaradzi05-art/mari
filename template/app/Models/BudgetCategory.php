<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $budget_profile_id
 * @property string $name
 * @property string $frequency
 * @property int $planned_amount_cents
 * @property int $actual_amount_cents
 * @property int $position
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read float $actual_amount
 * @property-read float $planned_amount
 * @property-read float $variance
 * @property-read \App\Models\BudgetProfile $profile
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetCategory newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetCategory newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetCategory query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetCategory whereActualAmountCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetCategory whereBudgetProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetCategory whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetCategory whereFrequency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetCategory whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetCategory whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetCategory wherePlannedAmountCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetCategory wherePosition($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetCategory whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class BudgetCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'budget_profile_id',
        'name',
        'frequency',
        'planned_amount_cents',
        'actual_amount_cents',
        'position',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(BudgetProfile::class, 'budget_profile_id');
    }

    public function getPlannedAmountAttribute(): float
    {
        return $this->planned_amount_cents / 100;
    }

    public function getActualAmountAttribute(): float
    {
        return $this->actual_amount_cents / 100;
    }

    public function getVarianceAttribute(): float
    {
        return $this->actual_amount_cents / 100 - $this->planned_amount_cents / 100;
    }
}
