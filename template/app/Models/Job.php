<?php

namespace App\Models;

use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property string $queue
 * @property int $company_id
 * @property int $job_category_id
 * @property int $job_role_id
 * @property int $job_experience_id
 * @property int $education_id
 * @property int $job_type_id
 * @property int $salary_type_id
 * @property string $title
 * @property string $slug
 * @property string $vacancies
 * @property float|null $min_salary
 * @property float|null $max_salary
 * @property string|null $custom_salary
 * @property string $deadline
 * @property string $description
 * @property string $status
 * @property string $workflow_stage
 * @property string $workflow_status
 * @property string $workflow_priority
 * @property string|null $workflow_submitted_at
 * @property string|null $workflow_reviewed_at
 * @property string|null $workflow_last_transition_at
 * @property int|null $workflow_reviewer_id
 * @property string|null $workflow_notes
 * @property string|null $workflow_payload
 * @property string $workflow_source
 * @property string|null $workflow_auto_publish_at
 * @property string|null $workflow_auto_archive_at
 * @property string $apply_on
 * @property string|null $apply_email
 * @property string|null $apply_url
 * @property int|null $featured
 * @property int|null $highlight
 * @property string|null $featured_until
 * @property string|null $highlight_until
 * @property int $total_views
 * @property int|null $city_id
 * @property int|null $state_id
 * @property int|null $country_id
 * @property string|null $address
 * @property string $salary_mode
 * @property string|null $company_name
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\AppliedJob> $applications
 * @property int|null applications_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\JobBenefits> $benefits
 * @property int|null benefits_count
 * @property-read \App\Models\JobCategory $category
 * @property-read \App\Models\City|null $city
 * @property-read \App\Models\Company $company
 * @property-read \App\Models\Country|null $country
 * @property-read \App\Models\Education|null $jobEduction
 * @property-read \App\Models\JobExperience|null $jobExperience
 * @property-read \App\Models\JobRole|null $jobRole
 * @property-read \App\Models\JobType|null $jobType
 * @property-read \App\Models\SalaryType|null $salaryType
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\JobSkills> $skills
 * @property int|null skills_count
 * @property-read \App\Models\State|null $state
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\JobTag> $tags
 * @property int|null tags_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job findSimilarSlugs(string $attribute, array $config, string $slug)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereAddress($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereApplyEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereApplyOn($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereApplyUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereCityId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereCompanyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereCompanyName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereCountryId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereCustomSalary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereDeadline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereEducationId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereFeatured($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereFeaturedUntil($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereHighlight($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereHighlightUntil($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereJobCategoryId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereJobExperienceId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereJobRoleId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereJobTypeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereMaxSalary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereMinSalary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereQueue($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereSalaryMode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereSalaryTypeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereStateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereTotalViews($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereVacancies($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereWorkflowAutoArchiveAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereWorkflowAutoPublishAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereWorkflowLastTransitionAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereWorkflowNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereWorkflowPayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereWorkflowPriority($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereWorkflowReviewedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereWorkflowReviewerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereWorkflowSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereWorkflowStage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereWorkflowStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job whereWorkflowSubmittedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job withUniqueSlugConstraints(\Illuminate\Database\Eloquent\Model $model, string $attribute, array $config, string $slug)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Job withoutTrashed()
 * @method static \Database\Factories\JobFactory factory($count = null, $state = [])
 *
 * @mixin \Eloquent
 */
final class Job extends Model
{
    use HasFactory, Sluggable, SoftDeletes;

    /**
     * @return string[][]
     *
     * @psalm-return array{slug: array{source: 'title'}}
     */
    #[\Override]
    public function sluggable(): array
    {
        return [
            'slug' => [
                'source' => 'title',
            ],
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(JobCategory::class, 'job_category_id', 'id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id', 'id');
    }

    public function jobType(): BelongsTo
    {
        return $this->belongsTo(JobType::class, 'job_type_id', 'id');
    }

    public function jobRole(): BelongsTo
    {
        return $this->belongsTo(JobRole::class, 'job_role_id', 'id');
    }

    public function salaryType(): BelongsTo
    {
        return $this->belongsTo(SalaryType::class, 'salary_type_id', 'id');
    }

    public function jobExperience(): BelongsTo
    {
        return $this->belongsTo(JobExperience::class, 'job_experience_id', 'id');
    }

    public function jobEduction(): BelongsTo
    {
        return $this->belongsTo(Education::class, 'education_id', 'id');
    }

    public function tags(): HasMany
    {
        return $this->hasMany(JobTag::class, 'job_id', 'id');
    }

    public function benefits(): HasMany
    {
        return $this->hasMany(JobBenefits::class, 'job_id', 'id');
    }

    public function skills(): HasMany
    {
        return $this->hasMany(JobSkills::class, 'job_id', 'id');
    }

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function state(): BelongsTo
    {
        return $this->belongsTo(State::class);
    }

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    public function applications(): HasMany
    {
        return $this->hasMany(AppliedJob::class, 'job_id', 'id');
    }
}
