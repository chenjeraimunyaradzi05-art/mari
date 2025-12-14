<?php

namespace App\Models\Pathways;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $life_pathway_id
 * @property int|null $phase_number
 * @property string|null $phase_title
 * @property string|null $phase_description
 * @property int $sequence
 * @property string $title
 * @property string|null $description
 * @property int|null $estimated_duration_weeks
 * @property string|null $estimated_cost_aud
 * @property string $status
 * @property string|null $started_at
 * @property string|null $completed_at
 * @property string $readiness_state
 * @property string|null $mentor_type
 * @property string|null $support_level
 * @property int $impact_weight
 * @property array<array-key, mixed>|null $dependencies
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Pathways\PathwayMilestone> $milestones
 * @property int|null milestones_count
 * @property-read \App\Models\Pathways\LifePathway $pathway
 * @method static \Database\Factories\Pathways\PathwayPhaseFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereDependencies($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereEstimatedCostAud($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereEstimatedDurationWeeks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereImpactWeight($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereLifePathwayId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereMentorType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase wherePhaseDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase wherePhaseNumber($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase wherePhaseTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereReadinessState($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereSequence($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereStartedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereSupportLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayPhase whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class PathwayPhase extends Model
{
    use HasFactory;

    protected $fillable = [
        'life_pathway_id',
        'sequence',
        'title',
        'description',
        'estimated_duration_weeks',
        'estimated_cost_aud',
        'readiness_state',
        'mentor_type',
        'support_level',
        'impact_weight',
        'dependencies',
        'metadata',
    ];

    protected $casts = [
        'dependencies' => 'array',
        'metadata' => 'array',
    ];

    public function pathway(): BelongsTo
    {
        return $this->belongsTo(LifePathway::class, 'life_pathway_id');
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(PathwayMilestone::class)->orderBy('sequence');
    }
}

