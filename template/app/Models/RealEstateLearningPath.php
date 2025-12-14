<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $title
 * @property string $slug
 * @property string $path_type
 * @property string $difficulty_level
 * @property int|null $duration_weeks
 * @property array<array-key, mixed>|null $modules
 * @property array<array-key, mixed>|null $associated_courses
 * @property bool $ai_guided
 * @property array<array-key, mixed>|null $outcomes
 * @property string|null $summary
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\LearningPathEnrolment> $enrolments
 * @property int|null enrolments_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\User> $participants
 * @property int|null participants_count
 *
 * @method static \Database\Factories\RealEstateLearningPathFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath whereAiGuided($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath whereAssociatedCourses($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath whereDifficultyLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath whereDurationWeeks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath whereModules($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath whereOutcomes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath wherePathType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath whereSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RealEstateLearningPath whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class RealEstateLearningPath extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'slug',
        'path_type',
        'difficulty_level',
        'duration_weeks',
        'modules',
        'associated_courses',
        'ai_guided',
        'outcomes',
        'summary',
    ];

    protected $casts = [
        'modules' => 'array',
        'associated_courses' => 'array',
        'ai_guided' => 'boolean',
        'outcomes' => 'array',
    ];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (RealEstateLearningPath $path): void {
            if (empty($path->slug) && ! empty($path->title)) {
                $baseSlug = Str::slug($path->title) ?: Str::random(8);
                $slugCandidate = $baseSlug;

                while (self::query()->where('slug', $slugCandidate)->exists()) {
                    $slugCandidate = $baseSlug.'-'.Str::random(4);
                }

                $path->slug = $slugCandidate;
            }
        });
    }

    /**
     * @psalm-return 'slug'
     */
    #[\Override]
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function enrolments(): HasMany
    {
        return $this->hasMany(LearningPathEnrolment::class, 'real_estate_learning_path_id');
    }

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'learning_path_enrolments')
            ->withPivot(['enrolment_status', 'progress_percent', 'notes', 'last_ai_check_in_at'])
            ->withTimestamps();
    }
}
