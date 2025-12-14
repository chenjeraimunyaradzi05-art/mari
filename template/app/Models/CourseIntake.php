<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property int $id
 * @property int $course_id
 * @property \Illuminate\Support\Carbon $start_on
 * @property \Illuminate\Support\Carbon|null $apply_by
 * @property int|null $seats
 * @property array<array-key, mixed>|null $scholarships
 * @property array<array-key, mixed>|null $eligibility_requirements
 * @property array<array-key, mixed>|null $support_services
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Course $course
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SubsidyProgram> $subsidyPrograms
 * @property int|null subsidy_programs_count
 *
 * @method static \Database\Factories\CourseIntakeFactory factory($count = null, $state = [])
 * @method static Builder<static>|CourseIntake newModelQuery()
 * @method static Builder<static>|CourseIntake newQuery()
 * @method static Builder<static>|CourseIntake open()
 * @method static Builder<static>|CourseIntake query()
 * @method static Builder<static>|CourseIntake whereApplyBy($value)
 * @method static Builder<static>|CourseIntake whereCourseId($value)
 * @method static Builder<static>|CourseIntake whereCreatedAt($value)
 * @method static Builder<static>|CourseIntake whereEligibilityRequirements($value)
 * @method static Builder<static>|CourseIntake whereId($value)
 * @method static Builder<static>|CourseIntake whereScholarships($value)
 * @method static Builder<static>|CourseIntake whereSeats($value)
 * @method static Builder<static>|CourseIntake whereStartOn($value)
 * @method static Builder<static>|CourseIntake whereStatus($value)
 * @method static Builder<static>|CourseIntake whereSupportServices($value)
 * @method static Builder<static>|CourseIntake whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CourseIntake extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'start_on',
        'apply_by',
        'seats',
        'scholarships',
        'eligibility_requirements',
        'support_services',
        'status',
    ];

    protected $casts = [
        'start_on' => 'date',
        'apply_by' => 'date',
        'scholarships' => 'array',
        'eligibility_requirements' => 'array',
        'support_services' => 'array',
    ];

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('status', 'open');
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function subsidyPrograms(): BelongsToMany
    {
        return $this->belongsToMany(SubsidyProgram::class, 'course_intake_subsidy_program')
            ->withPivot(['max_claims', 'status', 'notes'])
            ->withTimestamps();
    }
}
