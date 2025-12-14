<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $profile_id
 * @property string $event_type
 * @property string $headline
 * @property string|null $summary
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $occurred_at
 * @property string|null $fingerprint
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenRealEstate\WomenCohortProfile $profile
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenCohortTimelineEvent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenCohortTimelineEvent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenCohortTimelineEvent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenCohortTimelineEvent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenCohortTimelineEvent whereEventType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenCohortTimelineEvent whereFingerprint($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenCohortTimelineEvent whereHeadline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenCohortTimelineEvent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenCohortTimelineEvent whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenCohortTimelineEvent whereOccurredAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenCohortTimelineEvent whereProfileId($value)
 * @method static \\Illuminate\Database\Eloquent\Builder<static>|WomenCohortTimelineEvent whereSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenCohortTimelineEvent whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WomenCohortTimelineEvent extends Model
{
    use HasFactory;

    protected $table = 'women_cohort_timeline_events';

    protected $fillable = [
        'profile_id',
        'event_type',
        'headline',
        'summary',
        'metadata',
        'occurred_at',
        'fingerprint',
    ];

    protected $casts = [
        'metadata' => 'array',
        'occurred_at' => 'datetime',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(WomenCohortProfile::class, 'profile_id');
    }
}

