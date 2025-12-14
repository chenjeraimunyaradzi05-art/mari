<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $budget_id
 * @property string $type
 * @property string|null $category
 * @property string|null $description
 * @property int $amount
 * @property string $frequency
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Budget $budget
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetItem newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetItem newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetItem query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetItem whereAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetItem whereBudgetId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetItem whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetItem whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetItem whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetItem whereFrequency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetItem whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetItem whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetItem whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class BudgetItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'budget_id',
        'type',
        'category',
        'description',
        'amount',
        'frequency',
    ];

    protected $casts = [
        'amount' => 'int',
    ];

    public function budget(): BelongsTo
    {
        return $this->belongsTo(Budget::class);
    }
}
