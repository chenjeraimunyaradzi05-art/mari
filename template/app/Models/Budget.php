<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property string $scope
 * @property string|null $label
 * @property string $currency
 * @property int|null $savings_goal_monthly
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\BudgetItem> $items
 * @property int|null items_count
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Budget newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Budget newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Budget query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Budget whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Budget whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Budget whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Budget whereLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Budget whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Budget whereSavingsGoalMonthly($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>final |Budget whereScope($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Budget whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Budget whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class Budget extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'scope',
        'label',
        'currency',
        'savings_goal_monthly',
        'notes',
    ];

    protected $casts = [
        'savings_goal_monthly' => 'int',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(BudgetItem::class);
    }
}
