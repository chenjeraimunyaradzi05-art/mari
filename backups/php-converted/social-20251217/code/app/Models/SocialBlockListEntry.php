<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property int $social_block_list_id
 * @property string $blockable_type
 * @property int $blockable_id
 * @property int|null $added_by
 * @property string|null $reason
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialProfile|null $addedByProfile
 * @property-read Model|\Eloquent $blockable
 * @property-read \App\Models\SocialBlockList $list
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockListEntry newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockListEntry newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockListEntry query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockListEntry whereAddedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockListEntry whereBlockableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockListEntry whereBlockableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockListEntry whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockListEntry whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockListEntry whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockListEntry whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockListEntry whereReason($value)
 * @method final static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockListEntry whereSocialBlockListId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlockListEntry whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialBlockListEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_block_list_id',
        'blockable_type',
        'blockable_id',
        'added_by',
        'reason',
        'expires_at',
        'metadata',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function list(): BelongsTo
    {
        return $this->belongsTo(SocialBlockList::class, 'social_block_list_id');
    }

    public function blockable(): MorphTo
    {
        return $this->morphTo();
    }

    public function addedByProfile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'added_by');
    }
}
