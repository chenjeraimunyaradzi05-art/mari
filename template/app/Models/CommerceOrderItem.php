<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $commerce_order_id
 * @property int $commerce_product_id
 * @property int|null $commerce_product_variant_id
 * @property int|null $social_post_id
 * @property int $quantity
 * @property float $unit_price
 * @property string $currency
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommerceOrder $order
 * @property-read \App\Models\CommerceProduct $product
 * @property-read \App\Models\SocialPost|null $sourcePost
 * @property-read \App\Models\CommerceProductVariant|null $variant
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem whereCommerceOrderId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem whereCommerceProductId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem whereCommerceProductVariantId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem whereQuantity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem whereUnitPrice($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceOrderItem whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CommerceOrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'commerce_order_id',
        'commerce_product_id',
        'commerce_product_variant_id',
        'social_post_id',
        'quantity',
        'unit_price',
        'currency',
        'metadata',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'float',
        'metadata' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(CommerceOrder::class, 'commerce_order_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(CommerceProduct::class, 'commerce_product_id');
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(CommerceProductVariant::class, 'commerce_product_variant_id');
    }

    public function sourcePost(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }
}
