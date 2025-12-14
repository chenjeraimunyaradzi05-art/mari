<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $community_list_id
 * @property int $social_profile_id
 * @property int|null $added_by_profile_id
 * @property string $source
 * @property int|null $pinned_rank
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialProfile|null $addedBy
 * @property-read \App\Models\CommunityList $list
 * @property-read \App\Models\SocialProfile $profile
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityListEntry newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityListEntry newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityListEntry query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityListEntry whereAddedByProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityListEntry whereCommunityListId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityListEntry whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityListEntry whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityListEntry wherePinnedRank($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityListEntry whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityListEntry whereSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityListEntry whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CommunityListEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'community_list_id',
        'social_profile_id',
        'added_by_profile_id',
        'source',
        'pinned_rank',
    ];

    protected $casts = [
        'pinned_rank' => 'integer',
    ];

    public function list(): BelongsTo
    {
        return $this->belongsTo(CommunityList::class, 'community_list_id');
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'added_by_profile_id');
    }
}
