<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $social_profile_id
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property bool $is_private
 * @property int|null items_count
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostCollectionItem> $items
 * @property-read \App\Models\SocialProfile $owner
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollection newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollection newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollection query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollection whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollection whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollection whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollection whereIsPrivate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollection whereItemsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollection whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollection whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollection whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollection whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialPostCollection extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_profile_id',
        'name',
        'slug',
        'description',
        'is_private',
        'items_count',
    ];

    protected $casts = [
        'is_private' => 'boolean',
        'items_count' => 'integer',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(SocialPostCollectionItem::class);
    }

    public function incrementItemsCount(int $by = 1): void
    {
        $this->forceFill([
            'items_count' => max(0, $this->items_count + $by),
        ])->save();
    }
}

