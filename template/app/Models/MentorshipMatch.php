<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int|null $mentorship_cohort_id
 * @property int|null $mentorship_program_id
 * @property int $mentor_user_id
 * @property int $mentee_user_id
 * @property int|null $mentor_profile_id
 * @property int|null $mentee_profile_id
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $started_at
 * @property \Illuminate\Support\Carbon|null $next_check_in_at
 * @property array<array-key, mixed>|null $context
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $mentee
 * @property-read \App\Models\SocialProfile|null $menteeProfile
 * @property-read \App\Models\User $mentor
 * @property-read \App\Models\SocialProfile|null $mentorProfile
 * @property-read \App\Models\MentorshipCohort|null $mentorshipCohort
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch whereContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch whereMenteeProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch whereMenteeUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch whereMentorProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch whereMentorUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch whereMentorshipCohortId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch whereMentorshipProgramId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch whereNextCheckInAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch whereStartedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipMatch whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class MentorshipMatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'mentorship_cohort_id',
        'mentorship_program_id',
        'mentor_user_id',
        'mentee_user_id',
        'mentor_profile_id',
        'mentee_profile_id',
        'status',
        'started_at',
        'next_check_in_at',
        'context',
    ];

    protected $casts = [
        'context' => 'array',
        'started_at' => 'datetime',
        'next_check_in_at' => 'datetime',
    ];

    public function mentorshipCohort(): BelongsTo
    {
        return $this->belongsTo(MentorshipCohort::class);
    }

    public function mentor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentor_user_id');
    }

    public function mentee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentee_user_id');
    }

    public function mentorProfile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'mentor_profile_id');
    }

    public function menteeProfile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'mentee_profile_id');
    }
}
