<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string $name
 * @property string $profile_type
 * @property string $currency
 * @property int $income_total_cents
 * @property int $expense_total_cents
 * @property int $net_total_cents
 * @property float $net_trend_percent
 * @property int $savings_percent
 * @property int $runway_weeks
 * @property \Illuminate\Support\Carbon|null $break_even_date
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\BudgetCategory> $categories
 * @property int|null categories_count
 * @property-read float $expense_total
 * @property-read float $income_total
 * @property-read float $net_total
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\BudgetTransaction> $transactions
 * @property int|null transactions_count
 * @property-read \App\Models\User|null $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereBreakEvenDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereExpenseTotalCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereIncomeTotalCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereNetTotalCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereNetTrendPercent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereProfileType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereRunwayWeeks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereSavingsPercent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetProfile whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class BudgetProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'profile_type',
        'currency',
        'income_total_cents',
        'expense_total_cents',
        'net_total_cents',
        'net_trend_percent',
        'savings_percent',
        'runway_weeks',
        'break_even_date',
        'metadata',
    ];

    protected $casts = [
        'break_even_date' => 'date',
        'metadata' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function categories(): HasMany
    {
        return $this->hasMany(BudgetCategory::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(BudgetTransaction::class);
    }

    public function getIncomeTotalAttribute(): float
    {
        return $this->income_total_cents / 100;
    }

    public function getExpenseTotalAttribute(): float
    {
        return $this->expense_total_cents / 100;
    }

    public function getNetTotalAttribute(): float
    {
        return $this->net_total_cents / 100;
    }
}
