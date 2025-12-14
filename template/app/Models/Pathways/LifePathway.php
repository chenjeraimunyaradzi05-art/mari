<?php

namespace App\Models\Pathways;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Pathways\PathwayPhase;
use App\Models\Pathways\PathwayMilestone;

/**
 * @property int $id
 * @property int $user_id
 * @property string|null $pathway_type
 * @property string|null $goal_title
 * @property string|null $goal_description
 * @property string|null $target_completion_date
 * @property string $title
 * @property string $goal_key
 * @property string $status
 * @property int $current_phase
 * @property int $total_phases
 * @property int $confidence_score
 * @property int $impact_score
 * @property int|null $total_duration_weeks
 * @property string|null $total_cost_aud
 * @property string $urgency_label
 * @property string|null $summary
 * @property array<array-key, mixed>|null $focus_areas
 * @property array<array-key, mixed>|null $ai_context
 * @property array<array-key, mixed>|null $metrics
 * @property \Illuminate\Support\Carbon|null $cached_at
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read int $progress
 * @property-read \Illuminate\Database\Eloquent\Collection<int, PathwayPhase> $phases
 * @property int|null phases_count
 * @property-read User $user
 * @method static \Database\Factories\Pathways\LifePathwayFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway forGoal(string $goalKey)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereAiContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereCachedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereConfidenceScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereCurrentPhase($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereFocusAreas($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereGoalDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereGoalKey($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereGoalTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereImpactScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereMetrics($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway wherePathwayType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereTargetCompletionDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereTotalCostAud($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereTotalDurationWeeks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereTotalPhases($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereUrgencyLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LifePathway whereUserId($value)
 * @mixin \Eloquent
 */
final class LifePathway extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'title',
        'goal_key',
        'status',
        'summary',
        'confidence_score',
        'impact_score',
        'total_duration_weeks',
        'total_cost_aud',
        'urgency_label',
        'focus_areas',
        'ai_context',
        'metrics',
        'cached_at',
        'published_at',
        'pathway_type',
        'goal_title',
        'goal_description',
        'target_completion_date',
        'current_phase',
        'total_phases',
    ];

    protected $casts = [
        'focus_areas' => 'array',
        'ai_context' => 'array',
        'metrics' => 'array',
        'cached_at' => 'datetime',
        'published_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function phases(): HasMany
    {
        return $this->hasMany(PathwayPhase::class)->orderBy('sequence');
    }

    public function scopeForGoal($query, string $goalKey)
    {
        return $query->where('goal_key', $goalKey);
    }

    public function recalculateTotals(): void
    {
        $duration = $this->phases->sum('estimated_duration_weeks');
        $cost = $this->phases->sum(fn (PathwayPhase $phase) => (float) $phase->estimated_cost_aud);

        $this->total_duration_weeks = $duration ?: null;
        $this->total_cost_aud = $cost ?: null;
        $this->save();
    }

    public function getProgressAttribute(): int
    {
        $milestones = $this->phases->flatMap->milestones;
        if ($milestones->isEmpty()) {
            return 0;
        }

        $progress = $milestones->avg(fn (PathwayMilestone $milestone) => $milestone->progress);

        return (int) round($progress);
    }
}

