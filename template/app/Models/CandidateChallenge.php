<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $candidate_id
 * @property int $challenge_id
 * @property string $status
 * @property int $current_progress
 * @property int $target_value
 * @property int $progress_percentage
 * @property \Illuminate\Support\Carbon $started_at
 * @property \Illuminate\Support\Carbon|null $completed_at
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property array<array-key, mixed>|null $progress_data
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Candidate $candidate
 * @property-read \App\Models\Challenge $challenge
 * @property-read string $status_color
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge completed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge inProgress()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge whereChallengeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge whereCurrentProgress($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge whereProgressData($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge whereProgressPercentage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge whereStartedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge whereTargetValue($value)
 final  * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateChallenge whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class CandidateChallenge extends Model
{
    protected $fillable = [
        'candidate_id',
        'challenge_id',
        'status',
        'current_progress',
        'target_value',
        'progress_percentage',
        'started_at',
        'completed_at',
        'expires_at',
        'progress_data',
    ];

    protected $casts = [
        'current_progress' => 'integer',
        'target_value' => 'integer',
        'progress_percentage' => 'integer',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'expires_at' => 'datetime',
        'progress_data' => 'array',
    ];

    /**
     * Get the candidate
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    /**
     * Get the challenge
     */
    public function challenge(): BelongsTo
    {
        return $this->belongsTo(Challenge::class);
    }

    /**
     * Update progress
     */
    public function updateProgress(int $progress): void
    {
        $this->current_progress = min($this->target_value, $progress);
        $this->progress_percentage = round(($this->current_progress / $this->target_value) * 100, 2);

        if ($this->current_progress >= $this->target_value) {
            $this->markAsCompleted();
        } else {
            $this->save();
        }
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
     * Check if expired
     */
    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at < now();
    }

    /**
     * Get status color
     */
    public function getStatusColorAttribute(): string
    {
        return match ($this->status) {
            'completed' => '#10B981',
            'in_progress' => '#3B82F6',
            'failed' => '#EF4444',
            'expired' => '#6B7280',
            default => '#F59E0B',
        };
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
}
