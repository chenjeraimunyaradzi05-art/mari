<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $commerce_product_id
 * @property string $name
 * @property string|null $sku
 * @property float|null $price
 * @property int $inventory
 * @property array<array-key, mixed>|null $attributes
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommerceProduct $product
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProductVariant newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProductVariant newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProductVariant query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProductVariant whereAttributes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProductVariant whereCommerceProductId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProductVariant whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProductVariant whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProductVariant whereInventory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProductVariant whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProductVariant whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProductVariant wherePrice($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProductVariant whereSku($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProductVariant whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CommerceProductVariant extends Model
{
    use HasFactory;

    protected $fillable = [
        'commerce_product_id',
        'name',
        'sku',
        'price',
        'inventory',
        'attributes',
        'metadata',
    ];

    protected $casts = [
        'price' => 'float',
        'inventory' => 'integer',
        'attributes' => 'array',
        'metadata' => 'array',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(CommerceProduct::class, 'commerce_product_id');
    }
}
