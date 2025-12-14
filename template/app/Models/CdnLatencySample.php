<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int|null $latency_ms
 * @property int|null $status_code
 * @property int|null $attempts
 * @property string|null $failure_reason
 * @property int|null $percentile_bucket
 * @property \Illuminate\Support\Carbon $recorded_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CdnLatencySample newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CdnLatencySample newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CdnLatencySample query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CdnLatencySample whereAttempts($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CdnLatencySample whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CdnLatencySample whereFailureReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CdnLatencySample whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CdnLatencySample whereLatencyMs($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CdnLatencySample wherePercentileBucket($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CdnLatencySample whereRecordedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CdnLatencySample whereStatusCode($value)final
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CdnLatencySample whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CdnLatencySample extends Model
{
    use HasFactory;

    protected $fillable = [
        'latency_ms',
        'recorded_at',
        'status_code',
        'attempts',
        'failure_reason',
        'percentile_bucket',
    ];

    protected $casts = [
        'latency_ms' => 'integer',
        'recorded_at' => 'datetime',
        'status_code' => 'integer',
        'attempts' => 'integer',
        'percentile_bucket' => 'integer',
    ];
}
