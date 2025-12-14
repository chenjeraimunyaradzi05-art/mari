<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $candidate_id
 * @property int $match_total
 * @property float $employer_diversity
 * @property float $role_diversity
 * @property float $location_diversity
 * @property float $average_score
 * @property float $score_variance
 * @property array<array-key, mixed>|null $payload
 * @property \Illuminate\Support\Carbon $recorded_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Candidate $candidate
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit whereAverageScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit whereEmployerDiversity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit whereLocationDiversity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit whereMatchTotal($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit wherePayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit whereRecordedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit whereRoleDiversity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|final JobRecommendationAudit whereScoreVariance($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRecommendationAudit whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class JobRecommendationAudit extends Model
{
    use HasFactory;

    protected $fillable = [
        'candidate_id',
        'match_total',
        'employer_diversity',
        'role_diversity',
        'location_diversity',
        'average_score',
        'score_variance',
        'payload',
        'recorded_at',
    ];

    protected $casts = [
        'recorded_at' => 'datetime',
        'payload' => 'array',
        'employer_diversity' => 'float',
        'role_diversity' => 'float',
        'location_diversity' => 'float',
        'average_score' => 'float',
        'score_variance' => 'float',
    ];

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }
}
