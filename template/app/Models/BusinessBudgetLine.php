<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $business_budget_id
 * @property string $line_type
 * @property string|null $category
 * @property string|null $label
 * @property float $planned_amount
 * @property int $sort_order
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\BusinessBudget $budget
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudgetLine newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudgetLine newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudgetLine query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudgetLine whereBusinessBudgetId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudgetLine whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudgetLine whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudgetLine whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudgetLine whereLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudgetLine whereLineType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudgetLine whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudgetLine wherePlannedAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudgetLine whereSortOrder($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessBudgetLine whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class BusinessBudgetLine extends Model
{
    use HasFactory;

    protected $fillable = [
        'business_budget_id',
        'line_type',
        'category',
        'label',
        'planned_amount',
        'sort_order',
        'notes',
    ];

    protected $casts = [
        'planned_amount' => 'float',
    ];

    public function budget(): BelongsTo
    {
        return $this->belongsTo(BusinessBudget::class, 'business_budget_id');
    }
}
