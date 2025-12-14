<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property \Illuminate\Support\Carbon $snapshot_date
 * @property string $scope
 * @property int $jobs_warmed
 * @property int $success_count
 * @property int $failure_count
 * @property string $failure_rate
 * @property int $avg_duration_ms
 * @property int $p95_duration_ms
 * @property int $p99_duration_ms
 * @property array<array-key, mixed>|null $stats
 * @property string|null $notes
 * @property string|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot forScope(string $scope)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot latestSnapshot()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereAvgDurationMs($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereFailureCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereFailureRate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereJobsWarmed($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereP95DurationMs($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereP99DurationMs($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereScope($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereSnapshotDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereStats($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereSuccessCount($value)
 *final  @method static \Illuminate\Database\Eloquent\Builder<static>|WarmupMetricSnapshot whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WarmupMetricSnapshot extends Model
{
	use HasFactory;

	protected $fillable = [
		'snapshot_date',
		'scope',
		'jobs_warmed',
		'success_count',
		'failure_count',
		'avg_duration_ms',
		'p95_duration_ms',
		'stats',
	];

	protected $casts = [
		'snapshot_date' => 'date',
		'jobs_warmed' => 'integer',
		'success_count' => 'integer',
		'failure_count' => 'integer',
		'avg_duration_ms' => 'integer',
		'p95_duration_ms' => 'integer',
		'stats' => 'array',
	];

	/**
	 * Scope for a specific scope key.
	 */
	public function scopeForScope($query, string $scope)
	{
		return $query->where('scope', $scope);
	}

	/**
	 * Scope for latest snapshots.
	 */
	public function scopeLatestSnapshot($query)
	{
		return $query->orderByDesc('snapshot_date');
	}
}
