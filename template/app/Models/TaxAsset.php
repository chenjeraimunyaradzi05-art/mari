<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string|null $description
 * @property \Illuminate\Support\Carbon $purchase_date
 * @property numeric $cost
 * @property numeric|null $current_value
 * @property string $depreciation_type
 * @property numeric|null $depreciation_rate
 * @property string|null $serial_number
 * @property string|null $location
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Receipt> $receipts
 * @property int|null receipts_count
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset whereCost($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset whereCurrentValue($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset whereDepreciationRate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset whereDepreciationType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset wherePurchaseDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset whereSerialNumber($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TaxAsset whereUserId($value)
 * @mixin \Eloquent
 */
final class TaxAsset extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'description',
        'purchase_date',
        'cost',
        'current_value',
        'depreciation_type',
        'depreciation_rate',
        'serial_number',
        'location',
    ];

    protected $casts = [
        'purchase_date' => 'date',
        'cost' => 'decimal:2',
        'current_value' => 'decimal:2',
        'depreciation_rate' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(Receipt::class);
    }
}

