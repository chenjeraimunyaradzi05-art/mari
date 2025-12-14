<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $provider_org_page_id
 * @property string|null $code
 * @property string $title
 * @property string|null $slug
 * @property string|null $summary
 * @property string $type
 * @property string $mode
 * @property array<array-key, mixed>|null $delivery_options
 * @property string|null $location
 * @property int|null $duration_weeks
 * @property int|null $cost_cents
 * @property array<array-key, mixed>|null $funding
 * @property array<array-key, mixed>|null $prerequisites
 * @property array<array-key, mixed>|null $outcomes
 * @property array<array-key, mixed>|null $tags
 * @property string|null $application_url
 * @property string|null $contact_email
 * @property string|null $contact_phone
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ApprenticeshipProgram> $apprenticeships
 * @property int|null apprenticeships_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CourseIntake> $intakes
 * @property int|null intakes_count
 * @property-read \App\Models\OrganizationPage $page
 *
 * @method static \Database\Factories\CourseFactory factory($count = null, $state = [])
 * @method static Builder<static>|Course newModelQuery()
 * @method static Builder<static>|Course newQuery()
 * @method static Builder<static>|Course onlyTrashed()
 * @method static Builder<static>|Course published()
 * @method static Builder<static>|Course query()
 * @method static Builder<static>|Course whereApplicationUrl($value)
 * @method static Builder<static>|Course whereCode($value)
 * @method static Builder<static>|Course whereContactEmail($value)
 * @method static Builder<static>|Course whereContactPhone($value)
 * @method static Builder<static>|Course whereCostCents($value)
 * @method static Builder<static>|Course whereCreatedAt($value)
 * @method static Builder<static>|Course whereDeletedAt($value)
 * @method static Builder<static>|Course whereDeliveryOptions($value)
 * @method static Builder<static>|Course whereDurationWeeks($value)
 * @method static Builder<static>|Course whereFunding($value)
 * @method static Builder<static>|Course whereId($value)
 * @method static Builder<static>|Course whereLocation($value)
 * @method static Builder<static>|Course whereMode($value)
 * @method static Builder<static>|Course whereOutcomes($value)
 * @method static Builder<static>|Course wherePrerequisites($value)
 * @method static Builder<static>|Course whereProviderOrgPageId($value)
 * @method static Builder<static>|Course wherePublishedAt($value)
 * @method static Builder<static>|Course whereSlug($value)
 * @method static Builder<static>|Course whereStatus($value)
 * @method static Builder<static>|Course whereSummary($value)
 * @method static Builder<static>|Course whereTags(final $value)
 * @method static Builder<static>|Course whereTitle($value)
 * @method static Builder<static>|Course whereType($value)
 * @method static Builder<static>|Course whereUpdatedAt($value)
 * @method static Builder<static>|Course withTrashed(bool $withTrashed = true)
 * @method static Builder<static>|Course withoutTrashed()
 *
 * @mixin \Eloquent
 */
final class Course extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'provider_org_page_id',
        'code',
        'title',
        'summary',
        'slug',
        'type',
        'mode',
        'location',
        'delivery_options',
        'duration_weeks',
        'cost_cents',
        'funding',
        'prerequisites',
        'outcomes',
        'tags',
        'application_url',
        'contact_email',
        'contact_phone',
        'status',
        'published_at',
    ];

    protected $casts = [
        'delivery_options' => 'array',
        'funding' => 'array',
        'prerequisites' => 'array',
        'outcomes' => 'array',
        'tags' => 'array',
        'published_at' => 'datetime',
    ];

    #[\Override]
    protected static function booted(): void
    {
        self::saving(function (Course $course): void {
            if (blank($course->slug) && filled($course->title)) {
                $course->slug = Str::slug($course->title);
            }

            if ($course->isDirty('slug') && filled($course->slug)) {
                $course->slug = static::uniqueSlug($course->slug, $course->id);
            }

            if ($course->isDirty('status') && $course->status === 'published' && blank($course->published_at)) {
                $course->published_at = now();
            }
        });
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(OrganizationPage::class, 'provider_org_page_id');
    }

    public function intakes(): HasMany
    {
        return $this->hasMany(CourseIntake::class);
    }

    public function apprenticeships(): HasMany
    {
        return $this->hasMany(ApprenticeshipProgram::class, 'org_page_id', 'provider_org_page_id');
    }

    private static function uniqueSlug(string $slug, ?int $ignoreId = null): string
    {
        $base = Str::slug($slug) ?: 'course';
        $uniqueSlug = $base;
        $counter = 1;

        while (self::where('slug', $uniqueSlug)
            ->when($ignoreId, fn (Builder $builder) => $builder->where('id', '!=', $ignoreId))
            ->exists()) {
            $uniqueSlug = $base.'-'.$counter++;
        }

        return $uniqueSlug;
    }
}
