<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property string|null $owner_type
 * @property int|null $owner_id
 * @property string $name
 * @property string $scope
 * @property string $status
 * @property array<array-key, mixed>|null $rules
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialBlockListEntry> $entries
 * @property int|null entries_count
 * @property-read Model|\Eloquent|null $owner
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockList newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockList newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockList query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockList whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockList whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockList whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockList whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockList whereOwnerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockList whereOwnerType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockList whereRules($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockList whereScope($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockList whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockList whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialBlockList extends Model
{
    use HasFactory;

    protected $fillable = [
        'owner_type',
        'owner_id',
        'name',
        'scope',
        'status',
        'rules',
        'metadata',
    ];

    protected $casts = [
        'rules' => 'array',
        'metadata' => 'array',
    ];

    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    public function entries(): HasMany
    {
        return $this->hasMany(SocialBlockListEntry::class);
    }

    public function createdByProfile(): ?BelongsTo
    {
        if ($this->owner_type === SocialProfile::class) {
            return $this->belongsTo(SocialProfile::class, 'owner_id');
        }

        return null;
    }
}

