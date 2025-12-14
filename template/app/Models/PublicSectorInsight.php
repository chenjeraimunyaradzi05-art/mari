<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $insight_type
 * @property string $metric_label
 * @property string $metric_value
 * @property string|null $change_label
 * @property float|null $change_percent
 * @property string $trend
 * @property string|null $summary
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight latestTrend()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight whereChangeLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight whereChangePercent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight whereInsightType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight whereMetricLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight whereMetricValue($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight whereSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight whereTrend($value)
 final  * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorInsight whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class PublicSectorInsight extends Model
{
    use HasFactory;

    protected $fillable = [
        'insight_type',
        'metric_label',
        'metric_value',
        'change_label',
        'change_percent',
        'trend',
        'summary',
        'metadata',
        'published_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'published_at' => 'datetime',
        'change_percent' => 'float',
    ];

    public function scopeLatestTrend($query)
    {
        return $query->orderByDesc('published_at');
    }
}
