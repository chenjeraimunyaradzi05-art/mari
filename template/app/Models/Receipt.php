<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $merchant_name
 * @property \Illuminate\Support\Carbon $date
 * @property numeric $amount
 * @property string|null $category
 * @property string|null $image_path
 * @property bool $tax_deductible
 * @property string|null $notes
 * @property int|null $tax_asset_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\TaxAsset|null $taxAsset
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt whereAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt whereDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt whereImagePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt whereMerchantName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt whereTaxAssetId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt whereTaxDeductible($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Receipt whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class Receipt extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'merchant_name',
        'date',
        'amount',
        'category',
        'image_path',
        'tax_deductible',
        'notes',
        'tax_asset_id',
    ];

    protected $casts = [
        'date' => 'date',
        'amount' => 'decimal:2',
        'tax_deductible' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function taxAsset(): BelongsTo
    {
        return $this->belongsTo(TaxAsset::class);
    }
}
