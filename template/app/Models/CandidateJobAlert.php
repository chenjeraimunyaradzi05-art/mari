<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $candidate_id
 * @property string|null $name
 * @property bool $is_active
 * @property array<array-key, mixed>|null $keywords
 * @property array<array-key, mixed>|null $job_categories
 * @property array<array-key, mixed>|null $job_types
 * @property array<array-key, mixed>|null $job_roles
 * @property array<array-key, mixed>|null $locations
 * @property array<array-key, mixed>|null $salary_range
 * @property array<array-key, mixed>|null $experience_levels
 * @property bool $email_enabled
 * @property bool $sms_enabled
 * @property bool $push_enabled
 * @property string $frequency
 * @property string|null $preferred_time
 * @property array<array-key, mixed>|null $quiet_hours
 * @property int $match_threshold
 * @property array<array-key, mixed>|null $ai_preferences
 * @property int $clicks_count
 * @property int $applications_count
 * @property \Illuminate\Support\Carbon|null $last_sent_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Candidate $candidate
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\JobAlertLog> $logs
 * @property int|null logs_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereAiPreferences($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereApplicationsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereClicksCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereEmailEnabled($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereExperienceLevels($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereFrequency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereJobCategories($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereJobRoles($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereJobTypes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereKeywords($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereLastSentAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereLocations($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereMatchThreshold($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert wherePreferredTime($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert wherePushEnabled($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereQuietHours($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereSalaryRange($value)final
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereSmsEnabled($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateJobAlert whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CandidateJobAlert extends Model
{
    use HasFactory;

    protected $fillable = [
        'candidate_id',
        'name',
        'is_active',
        'keywords',
        'job_categories',
        'job_types',
        'job_roles',
        'locations',
        'salary_range',
        'experience_levels',
        'email_enabled',
        'sms_enabled',
        'push_enabled',
        'frequency',
        'preferred_time',
        'quiet_hours',
        'match_threshold',
        'ai_preferences',
        'clicks_count',
        'applications_count',
        'last_sent_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'keywords' => 'array',
        'job_categories' => 'array',
        'job_types' => 'array',
        'job_roles' => 'array',
        'locations' => 'array',
        'salary_range' => 'array',
        'experience_levels' => 'array',
        'email_enabled' => 'boolean',
        'sms_enabled' => 'boolean',
        'push_enabled' => 'boolean',
        'quiet_hours' => 'array',
        'ai_preferences' => 'array',
        'last_sent_at' => 'datetime',
    ];

    /**
     * Get the candidate that owns the alert
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    /**
     * Get the alert logs
     */
    public function logs(): HasMany
    {
        return $this->hasMany(JobAlertLog::class, 'alert_id');
    }

    /**
     * Check if alert should run now
     */
    public function shouldRunNow(): bool
    {
        if (! $this->is_active) {
            return false;
        }

        // Check quiet hours
        if ($this->isInQuietHours()) {
            return false;
        }

        // Check frequency
        if ($this->frequency === 'immediate') {
            return true;
        }

        if ($this->frequency === 'daily') {
            return ! $this->last_sent_at || $this->last_sent_at->diffInHours(now()) >= 24;
        }

        if ($this->frequency === 'weekly') {
            return ! $this->last_sent_at || $this->last_sent_at->diffInDays(now()) >= 7;
        }

        return false;
    }

    /**
     * Check if current time is in quiet hours
     */
    public function isInQuietHours(): bool
    {
        if (! $this->quiet_hours) {
            return false;
        }

        $now = now()->format('H:i');
        $start = $this->quiet_hours['start'] ?? null;
        $end = $this->quiet_hours['end'] ?? null;

        if (! $start || ! $end) {
            return false;
        }

        return $now >= $start && $now <= $end;
    }

    /**
     * Get engagement rate
     */
    public function getEngagementRate(): float
    {
        $totalSent = $this->logs()->where('status', 'sent')->count();

        if ($totalSent === 0) {
            return 0;
        }

        $engaged = $this->logs()->whereIn('status', ['clicked', 'applied'])->count();

        return round(($engaged / $totalSent) * 100, 2);
    }

    /**
     * Get conversion rate (applications / clicks)
     */
    public function getConversionRate(): float
    {
        $totalClicked = $this->logs()->where('status', 'clicked')->count();

        if ($totalClicked === 0) {
            return 0;
        }

        $applied = $this->logs()->where('status', 'applied')->count();

        return round(($applied / $totalClicked) * 100, 2);
    }
}
