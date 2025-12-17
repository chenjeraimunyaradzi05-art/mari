<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property \Illuminate\Support\Carbon $captured_on
 * @property int|null $persona_id
 * @property int $total_connections
 * @property int $total_invites_sent
 * @property int $total_invites_accepted
 * @property float|null $messaging_civility_score
 * @property array<array-key, mixed>|null $connection_heatmap_bins
 * @property array<array-key, mixed>|null $connection_heatmap_bins_30d
 * @property array<array-key, mixed>|null $invite_funnel_bins
 * @property array<array-key, mixed>|null $cohort_tags
 * @property string|null $primary_cohort
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Profile|null $persona
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily whereCapturedOn($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily whereCohortTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily whereConnectionHeatmapBins($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily whereConnectionHeatmapBins30d($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily whereInviteFunnelBins($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily whereMessagingCivilityScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily wherePersonaId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily wherePrimaryCohort($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily whereTotalConnections($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily whereTotalInvitesAccepted($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily whereTotalInvitesSent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMetricsDaily whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialMetricsDaily extends Model
{
    use HasFactory;

    protected $table = 'social_metrics_daily';

    protected $fillable = [
        'captured_on',
        'persona_id',
        'total_connections',
        'total_invites_sent',
        'total_invites_accepted',
        'messaging_civility_score',
        'connection_heatmap_bins',
        'connection_heatmap_bins_30d',
        'invite_funnel_bins',
        'cohort_tags',
        'primary_cohort',
    ];

    protected $casts = [
        'captured_on' => 'date',
        'connection_heatmap_bins' => 'array',
        'connection_heatmap_bins_30d' => 'array',
        'invite_funnel_bins' => 'array',
        'messaging_civility_score' => 'float',
        'cohort_tags' => 'array',
        'primary_cohort' => 'string',
    ];

    public function persona(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'persona_id');
    }
}

