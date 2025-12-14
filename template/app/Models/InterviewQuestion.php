<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $question
 * @property string|null $description
 * @property string $type
 * @property string $difficulty
 * @property int|null $job_category_id
 * @property int|null $job_role_id
 * @property array<array-key, mixed>|null $keywords
 * @property string|null $sample_answer
 * @property array<array-key, mixed>|null $evaluation_criteria
 * @property int $time_limit
 * @property bool $is_active
 * @property int $usage_count
 * @property numeric $avg_score
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\InterviewAnswer> $answers
 * @property int|null answers_count
 * @property-read string $difficulty_color
 * @property-read string $formatted_time_limit
 * @property-read string $type_icon
 * @property-read \App\Models\JobCategory|null $jobCategory
 * @property-read \App\Models\JobRole|null $jobRole
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\InterviewQuestionTopic> $topics
 * @property int|null topics_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion ofDifficulty(string $difficulty)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion ofType(string $type)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereAvgScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereDifficulty($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereEvaluationCriteria($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereJobCategoryId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereJobRoleId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereKeywords($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereQuestion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereSampleAnswer($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereTimeLimit($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestion whereUsageCount($value)
 *
 * @mixin \Eloquent
 */
final class InterviewQuestion extends Model
{
    protected $fillable = [
        'question',
        'description',
        'type',
        'difficulty',
        'job_category_id',
        'job_role_id',
        'keywords',
        'sample_answer',
        'evaluation_criteria',
        'time_limit',
        'is_active',
        'usage_count',
        'avg_score',
    ];

    protected $casts = [
        'keywords' => 'array',
        'evaluation_criteria' => 'array',
        'is_active' => 'boolean',
        'time_limit' => 'integer',
        'usage_count' => 'integer',
        'avg_score' => 'decimal:2',
    ];

    /**
     * Get the job category
     */
    public function jobCategory(): BelongsTo
    {
        return $this->belongsTo(JobCategory::class);
    }

    /**
     * Get the job role
     */
    public function jobRole(): BelongsTo
    {
        return $this->belongsTo(JobRole::class);
    }

    /**
     * Get all topics
     */
    public function topics(): BelongsToMany
    {
        return $this->belongsToMany(InterviewQuestionTopic::class);
    }

    /**
     * Get all answers to this question
     */
    public function answers(): HasMany
    {
        return $this->hasMany(InterviewAnswer::class);
    }

    /**
     * Scope for active questions
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope by type
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope by difficulty
     */
    public function scopeOfDifficulty($query, string $difficulty)
    {
        return $query->where('difficulty', $difficulty);
    }

    /**
     * Increment usage count
     */
    public function incrementUsage(): void
    {
        $this->increment('usage_count');
    }

    /**
     * Update average score
     */
    public function updateAverageScore(float $newScore): void
    {
        $totalAnswers = $this->answers()->count();
        $currentTotal = $this->avg_score * ($totalAnswers - 1);
        $newAverage = ($currentTotal + $newScore) / $totalAnswers;

        $this->update(['avg_score' => $newAverage]);
    }

    /**
     * Get difficulty color
     */
    public function getDifficultyColorAttribute(): string
    {
        return match ($this->difficulty) {
            'entry' => '#10B981',
            'mid' => '#F59E0B',
            'senior' => '#E91E8C',
            'executive' => '#8B5CF6',
            default => '#6B7280',
        };
    }

    /**
     * Get type icon
     */
    public function getTypeIconAttribute(): string
    {
        return match ($this->type) {
            'behavioral' => 'fas fa-users',
            'technical' => 'fas fa-code',
            'situational' => 'fas fa-lightbulb',
            'competency' => 'fas fa-star',
            'case_study' => 'fas fa-briefcase',
            default => 'fas fa-question-circle',
        };
    }

    /**
     * Get formatted time limit
     */
    public function getFormattedTimeLimitAttribute(): string
    {
        $minutes = floor($this->time_limit / 60);
        $seconds = $this->time_limit % 60;

        if ($minutes > 0 && $seconds > 0) {
            return "{$minutes}m {$seconds}s";
        } elseif ($minutes > 0) {
            return "{$minutes}m";
        } else {
            return "{$seconds}s";
        }
    }
}
