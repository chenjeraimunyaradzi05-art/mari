<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $listing_id
 * @property int|null $user_id
 * @property string $platform
 * @property string $share_url
 * @property \Illuminate\Support\Carbon $shared_at
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenRealEstate\WomenListing $listing
 * @property-read User|null $user
 * @method static \Database\Factories\WomenRealEstate\WomenListingSocialShareFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingSocialShare newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingSocialShare newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingSocialShare query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingSocialShare whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingSocialShare whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingSocialShare whereListingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingSocialShare whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingSocialShare wherePlatform($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingSocialShare whereShareUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingSocialShare whereSharedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingSocialShare whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingSocialShare whereUserId($value)
 * @mixin \Eloquent
 */
final class WomenListingSocialShare extends Model
{
    use HasFactory;

    protected $table = 'women_listing_social_shares';

    protected $fillable = [
        'listing_id',
        'user_id',
        'platform',
        'share_url',
        'shared_at',
        'meta',
    ];

    protected $casts = [
        'shared_at' => 'datetime',
        'meta' => 'array',
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(WomenListing::class, 'listing_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}

