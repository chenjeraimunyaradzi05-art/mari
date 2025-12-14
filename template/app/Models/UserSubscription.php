<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $category
 * @property string $label
 * @property numeric $monthly_amount
 * @property string $necessity_level
 * @property bool $is_active
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserSubscription newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserSubscription newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserSubscription query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserSubscription whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserSubscription whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserSubscription whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserSubscription whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserSubscription whereLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserSubscription whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserSubscription whereMonthlyAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserSubscription whereNecessityLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserSubscription whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserSubscription whereUserId($value)
 * @mixin \Eloquent
 */
final class UserSubscription extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'category',
        'label',
        'monthly_amount',
        'necessity_level',
        'is_active',
        'meta',
    ];

    protected $casts = [
        'monthly_amount' => 'decimal:2',
        'is_active' => 'boolean',
        'meta' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

