<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $business_cashbook_id
 * @property \Illuminate\Support\Carbon $period_start
 * @property \Illuminate\Support\Carbon $period_end
 * @property string|null $title
 * @property string $currency
 * @property bool $auto_rollover
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\BusinessCashbook $cashbook
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\BusinessBudgetLine> $lines
 * @property int|null lines_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudget newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudget newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudget query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudget whereAutoRollover($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudget whereBusinessCashbookId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudget whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudget whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudget whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudget wherePeriodEnd($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudget wherePeriodStart($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudget whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudget whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class BusinessBudget extends Model
{
    use HasFactory;

    protected $fillable = [
        'business_cashbook_id',
        'period_start',
        'period_end',
        'title',
        'currency',
        'auto_rollover',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'auto_rollover' => 'boolean',
    ];

    public function cashbook(): BelongsTo
    {
        return $this->belongsTo(BusinessCashbook::class, 'business_cashbook_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(BusinessBudgetLine::class)->orderBy('sort_order');
    }
}
