<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $alert_id
 * @property int $job_id
 * @property int $candidate_id
 * @property int $match_score
 * @property string $channel
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $sent_at
 * @property \Illuminate\Support\Carbon|null $clicked_at
 * @property \Illuminate\Support\Carbon|null $applied_at
 * @property string|null $error_message
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CandidateJobAlert $alert
 * @property-read \App\Models\Candidate $candidate
 * @property-read \App\Models\Job $job
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog whereAlertId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog whereAppliedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog whereChannel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog whereClickedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog whereErrorMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog whereJobId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog whereMatchScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog whereSentAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobAlertLog whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class JobAlertLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'alert_id',
        'job_id',
        'candidate_id',
        'match_score',
        'channel',
        'status',
        'sent_at',
        'clicked_at',
        'applied_at',
        'error_message',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'clicked_at' => 'datetime',
        'applied_at' => 'datetime',
    ];

    /**
     * Get the alert
     */
    public function alert(): BelongsTo
    {
        return $this->belongsTo(CandidateJobAlert::class, 'alert_id');
    }

    /**
     * Get the job
     */
    public function job(): BelongsTo
    {
        return $this->belongsTo(Job::class);
    }

    /**
     * Get the candidate
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    /**
     * Mark as clicked
     */
    public function markAsClicked(): void
    {
        $this->update([
            'status' => 'clicked',
            'clicked_at' => now(),
        ]);

        // Update alert clicks count
        $this->alert->increment('clicks_count');
    }

    /**
     * Mark as applied
     */
    public function markAsApplied(): void
    {
        $this->update([
            'status' => 'applied',
            'applied_at' => now(),
        ]);

        // Update alert applications count
        $this->alert->increment('applications_count');
    }
}
