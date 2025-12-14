<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $commerce_channel_id
 * @property int|null $commerce_collection_id
 * @property int|null $social_post_id
 * @property string $name
 * @property string|null $sku
 * @property string $status
 * @property string|null $short_description
 * @property string|null $long_description
 * @property float $base_price
 * @property string $currency
 * @property int $inventory
 * @property array<array-key, mixed>|null $attributes
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommerceChannel $channel
 * @property-read \App\Models\CommerceCollection|null $collection
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommerceOrderItem> $orderItems
 * @property int|null order_items_count
 * @property-read \App\Models\SocialPost|null $post
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommerceProductVariant> $variants
 * @property int|null variants_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereAttributes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereBasePrice($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereCommerceChannelId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereCommerceCollectionId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereInventory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereLongDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereShortDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereSku($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereSocialPostIdfinal ($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceProduct whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CommerceProduct extends Model
{
    use HasFactory;

    protected $fillable = [
        'commerce_channel_id',
        'commerce_collection_id',
        'social_post_id',
        'name',
        'sku',
        'status',
        'short_description',
        'long_description',
        'base_price',
        'currency',
        'inventory',
        'attributes',
        'metadata',
    ];

    protected $casts = [
        'base_price' => 'float',
        'inventory' => 'integer',
        'attributes' => 'array',
        'metadata' => 'array',
    ];

    public function channel(): BelongsTo
    {
        return $this->belongsTo(CommerceChannel::class, 'commerce_channel_id');
    }

    public function collection(): BelongsTo
    {
        return $this->belongsTo(CommerceCollection::class, 'commerce_collection_id');
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(CommerceProductVariant::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(CommerceOrderItem::class);
    }
}
