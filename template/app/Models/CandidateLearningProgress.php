<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $candidate_id
 * @property int $learning_resource_id
 * @property int $skill_id
 * @property string $status
 * @property int $progress_percentage
 * @property \Illuminate\Support\Carbon|null $started_at
 * @property \Illuminate\Support\Carbon|null $completed_at
 * @property int $time_spent
 * @property numeric|null $rating
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Candidate $candidate
 * @property-read string $formatted_time_spent
 * @property-read string $status_badge
 * @property-read string $status_color
 * @property-read \App\Models\LearningResource $learningResource
 * @property-read \App\Models\Skill $skill
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress completed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress forCandidate($candidateId)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress inProgress()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress notStarted()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress whereLearningResourceId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress whereProgressPercentage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress whereRating($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress whereSkillId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress whereStartedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress whereTimeSpent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLearningProgress whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CandidateLearningProgress extends Model
{
    protected $fillable = [
        'candidate_id',
        'learning_resource_id',
        'skill_id',
        'status',
        'progress_percentage',
        'started_at',
        'completed_at',
        'time_spent',
        'rating',
        'notes',
    ];

    protected $casts = [
        'progress_percentage' => 'integer',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'time_spent' => 'integer',
        'rating' => 'decimal:2',
    ];

    /**
     * Get the candidate
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    /**
     * Get the learning resource
     */
    public function learningResource(): BelongsTo
    {
        return $this->belongsTo(LearningResource::class);
    }

    /**
     * Get the skill
     */
    public function skill(): BelongsTo
    {
        return $this->belongsTo(Skill::class);
    }

    /**
     * Get status color
     */
    public function getStatusColorAttribute(): string
    {
        return match ($this->status) {
            'completed' => '#10B981',
            'in_progress' => '#3B82F6',
            'not_started' => '#6B7280',
            'abandoned' => '#EF4444',
            default => '#6B7280',
        };
    }

    /**
     * Get status badge
     */
    public function getStatusBadgeAttribute(): string
    {
        return match ($this->status) {
            'completed' => 'Completed',
            'in_progress' => 'In Progress',
            'not_started' => 'Not Started',
            'abandoned' => 'Abandoned',
            default => 'Unknown',
        };
    }

    /**
     * Get formatted time spent
     */
    public function getFormattedTimeSpentAttribute(): string
    {
        if (! $this->time_spent) {
            return '0m';
        }

        $hours = floor($this->time_spent / 60);
        $minutes = $this->time_spent % 60;

        if ($hours > 0) {
            return $minutes > 0 ? "{$hours}h {$minutes}m" : "{$hours}h";
        }

        return "{$minutes}m";
    }

    /**
     * Mark as started
     */
    public function markAsStarted(): void
    {
        $this->update([
            'status' => 'in_progress',
            'started_at' => now(),
        ]);
    }

    /**
     * Mark as completed
     */
    public function markAsCompleted(): void
    {
        $this->update([
            'status' => 'completed',
            'completed_at' => now(),
            'progress_percentage' => 100,
        ]);
    }

    /**
     * Update progress
     */
    public function updateProgress($percentage, $timeSpent = 0): void
    {
        $this->update([
            'progress_percentage' => min(100, max(0, $percentage)),
            'time_spent' => $this->time_spent + $timeSpent,
        ]);

        if ($percentage >= 100) {
            $this->markAsCompleted();
        }
    }

    /**
     * Scope for in progress
     */
    public function scopeInProgress($query)
    {
        return $query->where('status', 'in_progress');
    }

    /**
     * Scope for completed
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope for not started
     */
    public function scopeNotStarted($query)
    {
        return $query->where('status', 'not_started');
    }

    /**
     * Scope for candidate
     */
    public function scopeForCandidate($query, $candidateId)
    {
        return $query->where('candidate_id', $candidateId);
    }
}
