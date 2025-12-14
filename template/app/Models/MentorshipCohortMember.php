<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $mentorship_cohort_id
 * @property int|null $community_membership_id
 * @property int $social_profile_id
 * @property string $role
 * @property string $status
 * @property array<array-key, mixed>|null $progress
 * @property \Illuminate\Support\Carbon|null $joined_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\MentorshipCohort $cohort
 * @property-read \App\Models\CommunityMembership|null $membership
 * @property-read \App\Models\SocialProfile $profile
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohortMember newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohortMember newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohortMember query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohortMember whereCommunityMembershipId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohortMember whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohortMember whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohortMember whereJoinedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohortMember whereMentorshipCohortId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohortMember whereProgress($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohortMember whereRole($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohortMember whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohortMember whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohortMember whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class MentorshipCohortMember extends Model
{
    use HasFactory;

    protected $fillable = [
        'mentorship_cohort_id',
        'community_membership_id',
        'social_profile_id',
        'role',
        'status',
        'progress',
        'joined_at',
    ];

    protected $casts = [
        'progress' => 'array',
        'joined_at' => 'datetime',
    ];

    public function cohort(): BelongsTo
    {
        return $this->belongsTo(MentorshipCohort::class, 'mentorship_cohort_id');
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(CommunityMembership::class, 'community_membership_id');
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }
}
