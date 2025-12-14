<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $community_group_id
 * @property int|null $community_chapter_id
 * @property int $owner_profile_id
 * @property string $name
 * @property string $slug
 * @property string $type
 * @property string $visibility
 * @property array<array-key, mixed>|null $filters
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommunityChapter|null $chapter
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommunityListEntry> $entries
 * @property int|null entries_count
 * @property-read \App\Models\CommunityGroup $group
 * @property-read \App\Models\SocialProfile $ownerProfile
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList whereCommunityChapterId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList whereCommunityGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList whereFilters($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList whereOwnerProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList whereTypefinal ($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityList whereVisibility($value)
 *
 * @mixin \Eloquent
 */
final class CommunityList extends Model
{
    use HasFactory;

    protected $fillable = [
        'community_group_id',
        'community_chapter_id',
        'owner_profile_id',
        'name',
        'slug',
        'type',
        'visibility',
        'filters',
        'metadata',
    ];

    protected $casts = [
        'filters' => 'array',
        'metadata' => 'array',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(CommunityGroup::class, 'community_group_id');
    }

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(CommunityChapter::class, 'community_chapter_id');
    }

    public function ownerProfile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'owner_profile_id');
    }

    public function entries(): HasMany
    {
        return $this->hasMany(CommunityListEntry::class);
    }
}
