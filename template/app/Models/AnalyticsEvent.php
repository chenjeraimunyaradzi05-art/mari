<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;

/**
 * @property int $id
 * @property string $event
 * @property array<array-key, mixed>|null $properties
 * @property array<array-key, mixed>|null $metadata
 * @property string|null $source
 * @property \Illuminate\Support\Carbon|null $received_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static Builder<static>|AnalyticsEvent newModelQuery()
 * @method static Builder<static>|AnalyticsEvent newQuery()
 * @method static Builder<static>|AnalyticsEvent query()
 * @method static Builder<static>|AnalyticsEvent whereCreatedAt($value)
 * @method static Builder<static>|AnalyticsEvent whereEvent($value)
 * @method static Builder<static>|AnalyticsEvent whereId($value)
 * @method static Builder<static>|AnalyticsEvent whereMetadata($value)
 * @method static Builder<static>|AnalyticsEvent whereProperties($value)
 * @method static Builder<static>|AnalyticsEvent whereReceivedAt($value)
 * @method static Builder<static>|AnalyticsEvent whereSource($value)
 * @method static Builder<static>|AnalyticsEvent whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class AnalyticsEvent extends Model
{
    use HasFactory;
    use Prunable;

    protected $guarded = [];

    protected $casts = [
        'properties' => 'array',
        'metadata' => 'array',
        'received_at' => 'datetime',
    ];

    /**
     * @psalm-return Builder<static>
     */
    public function prunable(): Builder
    {
        $retentionDays = (int) config('analytics.ingestion.retention_days', 90);

        if ($retentionDays <= 0) {
            // use whereKey on the Eloquent builder so we return an Eloquent builder instance
            // (whereRaw is typed to the query builder in some analyzer configs).
            return self::query()->whereKey(-1);
        }

        return self::query()->where('received_at', '<', now()->subDays($retentionDays));
    }
}
