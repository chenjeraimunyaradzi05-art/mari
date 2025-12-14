<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $disk
 * @property string $path
 * @property string $media_type
 * @property string|null $caption
 * @property string $visibility
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read User $user
 * @method static \Database\Factories\WomenRealEstate\WomenUserMediaFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia whereCaption($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia whereDisk($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia whereMediaType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia wherePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia final whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenUserMedia whereVisibility($value)
 * @mixin \Eloquent
 */
final class WomenUserMedia extends Model
{
    use HasFactory;

    protected $table = 'women_real_estate_user_media';

    protected $fillable = [
        'user_id',
        'disk',
        'path',
        'media_type',
        'caption',
        'visibility',
        'meta',
        'published_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'published_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
