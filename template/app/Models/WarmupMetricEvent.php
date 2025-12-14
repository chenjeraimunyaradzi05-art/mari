<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int|null $job_id
 * @property int|null $candidate_id
 * @property string|null $warmable_type
 * @property int|null $warmable_id
 * @property string $action
 * @property string $status
 * @property string|null $failure_code
 * @property string $environment
 * @property int|null $duration_ms
 * @property string|null $latency_bucket
 * @property int $attempts
 * @property \Illuminate\Support\Carbon|null $started_at
 * @property \Illuminate\Support\Carbon|null $finished_at
 * @property array<array-key, mixed>|null $context
 * @property string|null $tags
 * @property string|null $metadata
 * @property string|null $error_message
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Candidate|null $candidate
 * @property-read \App\Models\Job|null $job
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent recent(int $days = 7)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereAttempts($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereDurationMs($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereEnvironment($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereErrorMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereFailureCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereFinishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereJobId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereLatencyBucket($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereStartedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereWarmableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricEvent whereWarmableType($value)
 * @mixin \Eloquent
 */
final class WarmupMetricEvent extends Model
{
	use HasFactory;

	protected $fillable = [
		'job_id',
		'candidate_id',
		'warmable_type',
		'warmable_id',
		'action',
		'status',
		'duration_ms',
		'attempts',
		'started_at',
		'finished_at',
		'context',
		'error_message',
	];

	protected $casts = [
		'duration_ms' => 'integer',
		'attempts' => 'integer',
		'started_at' => 'datetime',
		'finished_at' => 'datetime',
		'context' => 'array',
	];

	/**
	 * Warmed job relationship.
	 */
	public function job(): BelongsTo
	{
		return $this->belongsTo(Job::class);
	}

	/**
	 * Candidate relationship.
	 */
	public function candidate(): BelongsTo
	{
		return $this->belongsTo(Candidate::class);
	}

	/**
	 * Scope for recent activity.
	 */
	public function scopeRecent($query, int $days = 7)
	{
		return $query->where('created_at', '>=', now()->subDays($days));
	}

	/**
	 * Determine if the event completed successfully.
	 */
	public function isSuccessful(): bool
	{
		return $this->status === 'success';
	}
}

