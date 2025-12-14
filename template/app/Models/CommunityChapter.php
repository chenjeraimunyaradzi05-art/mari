<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $community_group_id
 * @property string $name
 * @property string $slug
 * @property string|null $region_code
 * @property string|null $timezone
 * @property string|null $meeting_cadence
 * @property int|null $chapter_lead_profile_id
 * @property int|null $member_limit
 * @property string $visibility
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommunityEvent> $events
 * @property int|null events_count
 * @property-read \App\Models\CommunityGroup $group
 * @property-read \App\Models\SocialProfile|null $lead
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommunityMembership> $memberships
 * @property int|null memberships_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommunityResource> $resources
 * @property int|null resources_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter whereChapterLeadProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter whereCommunityGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter whereMeetingCadence($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter whereMemberLimit($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter whereRegionCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter whereTimezone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityChapter whereVisibility($value)
 *
 * @mixin \Eloquent
 */
final class CommunityChapter extends Model
{
    use HasFactory;

    protected $fillable = [
        'community_group_id',
        'name',
        'slug',
        'region_code',
        'timezone',
        'meeting_cadence',
        'chapter_lead_profile_id',
        'member_limit',
        'visibility',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(CommunityGroup::class, 'community_group_id');
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'chapter_lead_profile_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(CommunityMembership::class, 'community_chapter_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(CommunityEvent::class, 'community_chapter_id');
    }

    public function resources(): HasMany
    {
        return $this->hasMany(CommunityResource::class, 'community_chapter_id');
    }
}
