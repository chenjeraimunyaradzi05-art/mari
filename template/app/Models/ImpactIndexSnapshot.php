<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $timeframe
 * @property \Illuminate\Support\Carbon $snapshot_date
 * @property array<array-key, mixed> $metrics
 * @property bool $is_public
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Database\Factories\ImpactIndexSnapshotFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ImpactIndexSnapshot newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ImpactIndexSnapshot newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ImpactIndexSnapshot query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ImpactIndexSnapshot whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ImpactIndexSnapshot whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ImpactIndexSnapshot whereIsPublic($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ImpactIndexSnapshot whereMetrics($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ImpactIndexSnapshot wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ImpactIndexSnapshot whereSnapshotDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ImpactIndexSnapshot whereTimeframe($value)
 final  * @method static \Illuminate\Database\Eloquent\Builder<static>|ImpactIndexSnapshot whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class ImpactIndexSnapshot extends Model
{
    use HasFactory;

    protected $fillable = [
        'timeframe',
        'snapshot_date',
        'metrics',
        'is_public',
        'published_at',
    ];

    protected $casts = [
        'snapshot_date' => 'date',
        'metrics' => 'array',
        'is_public' => 'boolean',
        'published_at' => 'datetime',
    ];

    public function getMetric(string $key, mixed $default = null): mixed
    {
        return data_get($this->metrics, $key, $default);
    }
}
