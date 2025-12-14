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
 * @property int|null $community_role_id
 * @property int $social_profile_id
 * @property int|null $invited_by_profile_id
 * @property int|null $source_follow_id
 * @property string $status
 * @property string $joined_via
 * @property \Illuminate\Support\Carbon|null $approved_at
 * @property \Illuminate\Support\Carbon|null $last_engaged_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommunityChapter|null $chapter
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MentorshipCohortMember> $cohortMemberships
 * @property int|null cohort_memberships_count
 * @property-read \App\Models\CommunityGroup $group
 * @property-read \App\Models\SocialProfile|null $invitedBy
 * @property-read \App\Models\SocialProfile $profile
 * @property-read \App\Models\CommunityRole|null $role
 * @property-read \App\Models\SocialFollow|null $sourceFollow
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership active()
 * @method static \Database\Factories\CommunityMembershipFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership whereApprovedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership whereCommunityChapterId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership whereCommunityGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership whereCommunityRoleId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership whereInvitedByProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership whereJoinedVia($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership whereLastEngagedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership whereSourceFollowId($value)final
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityMembership whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CommunityMembership extends Model
{
    use HasFactory;

    protected $fillable = [
        'community_group_id',
        'community_chapter_id',
        'community_role_id',
        'social_profile_id',
        'invited_by_profile_id',
        'source_follow_id',
        'status',
        'joined_via',
        'approved_at',
        'last_engaged_at',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
        'last_engaged_at' => 'datetime',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(CommunityGroup::class, 'community_group_id');
    }

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(CommunityChapter::class, 'community_chapter_id');
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(CommunityRole::class, 'community_role_id');
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'invited_by_profile_id');
    }

    public function sourceFollow(): BelongsTo
    {
        return $this->belongsTo(SocialFollow::class, 'source_follow_id');
    }

    public function cohortMemberships(): HasMany
    {
        return $this->hasMany(MentorshipCohortMember::class, 'community_membership_id');
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function can(string $permission): bool
    {
        return (bool) $this->role?->grants($permission);
    }
}
