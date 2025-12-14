<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $candidate_id
 * @property string $title
 * @property string $template
 * @property string $slug
 * @property string|null $professional_summary
 * @property string|null $phone
 * @property string|null $email
 * @property string|null $website
 * @property string|null $github
 * @property string|null $location
 * @property array<array-key, mixed>|null $work_experience
 * @property array<array-key, mixed>|null $education
 * @property array<array-key, mixed>|null $skills
 * @property array<array-key, mixed>|null $certifications
 * @property array<array-key, mixed>|null $projects
 * @property array<array-key, mixed>|null $languages
 * @property array<array-key, mixed>|null $achievements
 * @property array<array-key, mixed>|null $custom_sections
 * @property array<array-key, mixed>|null $ai_suggestions
 * @property int $ats_score
 * @property array<array-key, mixed>|null $keyword_optimization
 * @property array<array-key, mixed>|null $improvement_tips
 * @property string|null $share_token
 * @property bool $is_public
 * @property int $view_count
 * @property int $download_count
 * @property int $share_count
 * @property string|null $pdf_path
 * @property \Illuminate\Support\Carbon|null $pdf_generated_at
 * @property int $version
 * @property bool $is_active
 * @property string|null $meta_title
 * @property string|null $meta_description
 * @property string|null $og_image
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \App\Models\Candidate $candidate
 * @property-read array $all_skills
 * @property-read int $completion_percentage
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereAchievements($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereAiSuggestions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereAtsScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereCertifications($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereCustomSections($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereDownloadCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereEducation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereGithub($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereImprovementTips($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereIsPublic($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereKeywordOptimization($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereLanguages($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereMetaDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereMetaTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereOgImage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV wherePdfGeneratedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV wherePdfPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV wherePhone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereProfessionalSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereProjects($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereShareCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereShareToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereSkills($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereTemplate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereVersion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereViewCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV whereWebsite($value)
 * @method static \Illuminate\Database\Eloquent\\Builder<static>|CandidateCV whereWorkExperience($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateCV withoutTrashed()
 *
 * @mixin \Eloquent
 */
final class CandidateCV extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'candidate_cvs';

    protected $fillable = [
        'candidate_id',
        'title',
        'template',
        'slug',
        'professional_summary',
        'phone',
        'email',
        'website',
        'github',
        'location',
        'work_experience',
        'education',
        'skills',
        'certifications',
        'projects',
        'languages',
        'achievements',
        'custom_sections',
        'ai_suggestions',
        'ats_score',
        'keyword_optimization',
        'improvement_tips',
        'share_token',
        'is_public',
        'view_count',
        'download_count',
        'share_count',
        'pdf_path',
        'pdf_generated_at',
        'version',
        'is_active',
        'meta_title',
        'meta_description',
        'og_image',
    ];

    protected $casts = [
        'work_experience' => 'array',
        'education' => 'array',
        'skills' => 'array',
        'certifications' => 'array',
        'projects' => 'array',
        'languages' => 'array',
        'achievements' => 'array',
        'custom_sections' => 'array',
        'ai_suggestions' => 'array',
        'keyword_optimization' => 'array',
        'improvement_tips' => 'array',
        'is_public' => 'boolean',
        'is_active' => 'boolean',
        'pdf_generated_at' => 'datetime',
    ];

    protected $appends = ['all_skills', 'completion_percentage'];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (CandidateCV $cv) {
            if (empty($cv->slug)) {
                $cv->slug = static::generateUniqueSlug($cv->title ?? 'cv');
            }

            if (empty($cv->share_token)) {
                $cv->share_token = (string) Str::uuid();
            }

            if (empty($cv->version)) {
                $cv->version = 1;
            }
        });
    }

    public static function generateUniqueSlug(string $title, ?int $ignoreId = null): string
    {
        $base = Str::slug($title) ?: 'cv';
        $slug = $base;
        $counter = 1;

        while (self::query()
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->where('slug', $slug)
            ->exists()) {
            $slug = $base.'-'.$counter;
            $counter++;
        }

        return $slug;
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    /**
     * @psalm-return 'slug'
     */
    #[\Override]
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    public function getAllSkillsAttribute(): array
    {
        $skills = $this->skills ?? [];
        if (is_string($skills)) {
            $decoded = json_decode($skills, true);
            $skills = $decoded !== null ? $decoded : explode(',', $skills);
        }

        return collect(Arr::wrap($skills))
            ->flatMap(function ($item) {
                if (is_array($item)) {
                    return $item;
                }

                return [$item];
            })
            ->map(fn ($skill) => trim((string) $skill))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    public function getCompletionPercentageAttribute(): int
    {
        $sections = [
            $this->professional_summary,
            $this->skills,
            $this->work_experience,
            $this->education,
            $this->projects,
            $this->achievements,
        ];

        $total = count($sections);
        if ($total === 0) {
            return 0;
        }

        $completed = collect($sections)->filter(function ($value) {
            if (is_array($value)) {
                return count(array_filter($value)) > 0;
            }

            return filled($value);
        })->count();

        return (int) round(($completed / $total) * 100);
    }
}
