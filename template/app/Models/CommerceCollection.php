<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $commerce_channel_id
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property int|null $featured_post_id
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommerceChannel $channel
 * @property-read \App\Models\SocialPost|null $featuredPost
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommerceProduct> $products
 * @property int|null products_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceCollection newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceCollection newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceCollection query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceCollection whereCommerceChannelId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceCollection whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceCollection whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceCollection whereFeaturedPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceCollection whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceCollection whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceCollection whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceCollection wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceCollection whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceCollection whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CommerceCollection extends Model
{
    use HasFactory;

    protected $fillable = [
        'commerce_channel_id',
        'name',
        'slug',
        'description',
        'featured_post_id',
        'metadata',
        'published_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'published_at' => 'datetime',
    ];

    public function channel(): BelongsTo
    {
        return $this->belongsTo(CommerceChannel::class, 'commerce_channel_id');
    }

    public function featuredPost(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'featured_post_id');
    }

    public function products(): HasMany
    {
        return $this->hasMany(CommerceProduct::class, 'commerce_collection_id');
    }
}
