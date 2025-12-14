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
 * @property int|null $mentorship_program_id
 * @property int|null $mentor_profile_id
 * @property string $name
 * @property string $slug
 * @property string|null $cohort_code
 * @property string|null $focus_area
 * @property int|null $capacity
 * @property \Illuminate\Support\Carbon|null $starts_at
 * @property \Illuminate\Support\Carbon|null $ends_at
 * @property string|null $meeting_cadence
 * @property string|null $timezone
 * @property array<array-key, mixed>|null $matching_rules
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MentorshipCohortMember> $activeMembers
 * @property int|null active_members_count
 * @property-read \App\Models\CommunityChapter|null $chapter
 * @property-read \App\Models\CommunityGroup $group
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MentorshipCohortMember> $members
 * @property int|null members_count
 * @property-read \App\Models\SocialProfile|null $mentorProfile
 * @property-read \App\Models\MentorshipProgram|null $program
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereCapacity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereCohortCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereCommunityChapterId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereCommunityGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereEndsAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereFocusArea($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereMatchingRules($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereMeetingCadence($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereMentorProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereMentorshipProgramId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereStartsAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereTimezone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipCohort whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class MentorshipCohort extends Model
{
    use HasFactory;

    protected $fillable = [
        'community_group_id',
        'community_chapter_id',
        'mentorship_program_id',
        'mentor_profile_id',
        'name',
        'slug',
        'cohort_code',
        'focus_area',
        'capacity',
        'starts_at',
        'ends_at',
        'meeting_cadence',
        'timezone',
        'matching_rules',
        'status',
    ];

    protected $casts = [
        'capacity' => 'integer',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'matching_rules' => 'array',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(CommunityGroup::class, 'community_group_id');
    }

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(CommunityChapter::class, 'community_chapter_id');
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(MentorshipProgram::class, 'mentorship_program_id');
    }

    public function mentorProfile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'mentor_profile_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(MentorshipCohortMember::class);
    }

    /**
     * @psalm-return HasMany<Model, Model>
     */
    public function activeMembers(): HasMany
    {
        return $this->members()->where('status', 'active');
    }
}
