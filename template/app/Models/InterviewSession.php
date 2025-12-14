<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $candidate_id
 * @property string $title
 * @property string $session_type
 * @property int|null $job_category_id
 * @property int|null $job_role_id
 * @property string $difficulty
 * @property int $total_questions
 * @property int $answered_questions
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $started_at
 * @property \Illuminate\Support\Carbon|null $completed_at
 * @property int $total_time_spent
 * @property numeric|null $overall_score
 * @property array<array-key, mixed>|null $ai_feedback
 * @property array<array-key, mixed>|null $strengths
 * @property array<array-key, mixed>|null $improvements
 * @property array<array-key, mixed>|null $recommended_topics
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\InterviewAnswer> $answers
 * @property int|null answers_count
 * @property-read \App\Models\Candidate $candidate
 * @property-read int $average_answer_time
 * @property-read int $completion_percentage
 * @property-read string $formatted_duration
 * @property-read string $performance_color
 * @property-read string $performance_level
 * @property-read string $status_color
 * @property-read string $status_icon
 * @property-read \App\Models\JobCategory|null $jobCategory
 * @property-read \App\Models\JobRole|null $jobRole
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession completed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession inProgress()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereAiFeedback($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereAnsweredQuestions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereDifficulty($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereImprovements($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereJobCategoryId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereJobRoleId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereOverallScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereRecommendedTopics($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereSessionType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereStartedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereStrengths($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereTotalQuestions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<final static>|InterviewSession whereTotalTimeSpent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewSession whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class InterviewSession extends Model
{
    protected $fillable = [
        'candidate_id',
        'title',
        'session_type',
        'job_category_id',
        'job_role_id',
        'difficulty',
        'total_questions',
        'answered_questions',
        'status',
        'started_at',
        'completed_at',
        'total_time_spent',
        'overall_score',
        'ai_feedback',
        'strengths',
        'improvements',
        'recommended_topics',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'total_questions' => 'integer',
        'answered_questions' => 'integer',
        'total_time_spent' => 'integer',
        'overall_score' => 'decimal:2',
        'ai_feedback' => 'array',
        'strengths' => 'array',
        'improvements' => 'array',
        'recommended_topics' => 'array',
    ];

    /**
     * Get the candidate
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

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
     * Get all answers in this session
     */
    public function answers(): HasMany
    {
        return $this->hasMany(InterviewAnswer::class);
    }

    /**
     * Scope for in progress sessions
     */
    public function scopeInProgress($query)
    {
        return $query->where('status', 'in_progress');
    }

    /**
     * Scope for completed sessions
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Mark session as completed
     */
    public function markCompleted(): void
    {
        $this->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);
    }

    /**
     * Get completion percentage
     *
     *
     * @psalm-return 0|float
     */
    public function getCompletionPercentageAttribute(): int|float
    {
        if ($this->total_questions === 0) {
            return 0;
        }

        return round(($this->answered_questions / $this->total_questions) * 100);
    }

    /**
     * Get average answer time
     *
     *
     * @psalm-return 0|float
     */
    public function getAverageAnswerTimeAttribute(): int|float
    {
        if ($this->answered_questions === 0) {
            return 0;
        }

        return round($this->total_time_spent / $this->answered_questions);
    }

    /**
     * Get formatted duration
     */
    public function getFormattedDurationAttribute(): string
    {
        $minutes = floor($this->total_time_spent / 60);
        $seconds = $this->total_time_spent % 60;

        if ($minutes > 0) {
            return "{$minutes}m {$seconds}s";
        }

        return "{$seconds}s";
    }

    /**
     * Get status color
     */
    public function getStatusColorAttribute(): string
    {
        return match ($this->status) {
            'in_progress' => '#F59E0B',
            'completed' => '#10B981',
            'abandoned' => '#EF4444',
            default => '#6B7280',
        };
    }

    /**
     * Get status icon
     */
    public function getStatusIconAttribute(): string
    {
        return match ($this->status) {
            'in_progress' => 'fas fa-play-circle',
            'completed' => 'fas fa-check-circle',
            'abandoned' => 'fas fa-times-circle',
            default => 'fas fa-circle',
        };
    }

    /**
     * Get performance level based on score
     */
    public function getPerformanceLevelAttribute(): string
    {
        if (! $this->overall_score) {
            return 'Not Scored';
        }

        return match (true) {
            $this->overall_score >= 90 => 'Excellent',
            $this->overall_score >= 75 => 'Very Good',
            $this->overall_score >= 60 => 'Good',
            $this->overall_score >= 50 => 'Fair',
            default => 'Needs Improvement',
        };
    }

    /**
     * Get performance color
     */
    public function getPerformanceColorAttribute(): string
    {
        if (! $this->overall_score) {
            return '#6B7280';
        }

        return match (true) {
            $this->overall_score >= 90 => '#10B981',
            $this->overall_score >= 75 => '#3B82F6',
            $this->overall_score >= 60 => '#F59E0B',
            $this->overall_score >= 50 => '#EF4444',
            default => '#DC2626',
        };
    }
}
