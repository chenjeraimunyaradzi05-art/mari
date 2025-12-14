<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property string $owner_type
 * @property int $owner_id
 * @property string $name
 * @property string $status
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommerceCollection> $collections
 * @property int|null collections_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommerceOrder> $orders
 * @property int|null orders_count
 * @property-read Model|\Eloquent $owner
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommercePayoutBatch> $payoutBatches
 * @property int|null payout_batches_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommerceProduct> $products
 * @property int|null products_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceChannel newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceChannel newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceChannel query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceChannel whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceChannel whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceChannel whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceChannel whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceChannel whereOwnerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceChannel whereOwnerType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceChannel whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommerceChannel whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CommerceChannel extends Model
{
    use HasFactory;

    protected $fillable = [
        'owner_type',
        'owner_id',
        'name',
        'status',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    public function collections(): HasMany
    {
        return $this->hasMany(CommerceCollection::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(CommerceProduct::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(CommerceOrder::class);
    }

    public function payoutBatches(): HasMany
    {
        return $this->hasMany(CommercePayoutBatch::class);
    }

    public function primaryOwnerProfile(): ?BelongsTo
    {
        if ($this->owner_type === SocialProfile::class) {
            return $this->belongsTo(SocialProfile::class, 'owner_id');
        }

        return null;
    }
}
