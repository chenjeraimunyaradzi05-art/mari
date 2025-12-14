<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $scope
 * @property string $name
 * @property int $balance
 * @property float|null $interest_rate
 * @property int|null $min_payment
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Debt newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Debt newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Debt query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Debt whereBalance($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Debt whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Debt whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Debt whereInterestRate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Debt whereMinPayment($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Debt whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Debt whereScope($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Debt whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Debt whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class Debt extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'scope',
        'name',
        'balance',
        'interest_rate',
        'min_payment',
    ];

    protected $casts = [
        'balance' => 'int',
        'interest_rate' => 'float',
        'min_payment' => 'int',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
