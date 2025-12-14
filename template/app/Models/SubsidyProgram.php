<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int|null $organization_page_id
 * @property string $name
 * @property string $slug
 * @property string|null $category
 * @property string|null $summary
 * @property string|null $eligibility
 * @property int|null $amount_cents
 * @property int|null $coverage_percent
 * @property string $currency
 * @property \Illuminate\Support\Carbon|null $starts_on
 * @property \Illuminate\Support\Carbon|null $ends_on
 * @property string $status
 * @property string|null $application_url
 * @property string|null $contact_email
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CourseIntake> $courseIntakes
 * @property int|null course_intakes_count
 * @property-read \App\Models\OrganizationPage|null $organization
 * @method static Builder<static>|SubsidyProgram active()
 * @method static Builder<static>|SubsidyProgram newModelQuery()
 * @method static Builder<static>|SubsidyProgram newQuery()
 * @method static Builder<static>|SubsidyProgram onlyTrashed()
 * @method static Builder<static>|SubsidyProgram query()
 * @method static Builder<static>|SubsidyProgram whereAmountCents($value)
 * @method static Builder<static>|SubsidyProgram whereApplicationUrl($value)
 * @method static Builder<static>|SubsidyProgram whereCategory($value)
 * @method static Builder<static>|SubsidyProgram whereContactEmail($value)
 * @method static Builder<static>|SubsidyProgram whereCoveragePercent($value)
 * @method static Builder<static>|SubsidyProgram whereCreatedAt($value)
 * @method static Builder<static>|SubsidyProgram whereCurrency($value)
 * @method static Builder<static>|SubsidyProgram whereDeletedAt($value)
 * @method static Builder<static>|SubsidyProgram whereEligibility($value)
 * @method static Builder<static>|SubsidyProgram whereEndsOn($value)
 * @method static Builder<static>|SubsidyProgram whereId($value)
 * @method static Builder<static>|SubsidyProgram whereMeta($value)
 * @method static Builder<static>|SubsidyProgram whereName($value)
 * @method static Builder<static>|SubsidyProgram whereOrganizationPageId($value)
 * @method static Builder<static>|SubsidyProgram whereSlug($value)
 * @method static Builder<static>|SubsidyProgram whereStartsOn($value)
 * @method static Builder<static>|SubsidyProgram whereStatus($value)
 * @method static Builder<static>|SubsidyProgram whereSummary($value)
 * @method static Builder<static>|SubsidyProgram whereUpdatedAt($value)
 * @method static Builder<static>|SubsidyProgram withTrashed(bool $withTrashed = true)
 * @method static Builder<static>|SubsidyProgram withoutTrashed()
 * @mixin \Eloquent
 */
final class SubsidyProgram extends Model
{
	use HasFactory;
	use SoftDeletes;

	protected $fillable = [
		'organization_page_id',
		'name',
		'slug',
		'category',
		'summary',
		'eligibility',
		'amount_cents',
		'coverage_percent',
		'currency',
		'starts_on',
		'ends_on',
		'status',
		'application_url',
		'contact_email',
		'meta',
	];

	protected $casts = [
		'meta' => 'array',
		'starts_on' => 'date',
		'ends_on' => 'date',
	];

	#[\Override]
	protected static function booted(): void
	{
		static::saving(function (SubsidyProgram $program): void {
			if (blank($program->slug) && filled($program->name)) {
				$program->slug = Str::slug($program->name);
			}

			if ($program->isDirty('slug') && filled($program->slug)) {
				$program->slug = static::uniqueSlug($program->slug, $program->id);
			}
		});
	}

	/**
	 * @psalm-return Builder<Model>
	 */
	public function scopeActive(Builder $query): Builder
	{
		return $query->where('status', 'active');
	}

	public function organization(): BelongsTo
	{
		return $this->belongsTo(OrganizationPage::class, 'organization_page_id');
	}

	public function courseIntakes(): BelongsToMany
	{
		return $this->belongsToMany(CourseIntake::class, 'course_intake_subsidy_program')
			->withPivot(['max_claims', 'status', 'notes'])
			->withTimestamps();
	}

	private static function uniqueSlug(string $slug, ?int $ignoreId = null): string
	{
		$base = Str::slug($slug) ?: 'subsidy-program';
		$unique = $base;
		$counter = 1;

		while (static::where('slug', $unique)
			->when($ignoreId, fn (Builder $builder) => $builder->where('id', '!=', $ignoreId))
			->exists()) {
			$unique = $base.'-'.$counter++;
		}

		return $unique;
	}
}

