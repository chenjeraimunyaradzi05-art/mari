<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $procurement_opportunity_id
 * @property string|null $headline
 * @property string|null $executive_summary
 * @property string|null $problem_statement
 * @property array<array-key, mixed>|null $mission_objectives
 * @property array<array-key, mixed>|null $policy_links
 * @property array<array-key, mixed>|null $impact_metrics
 * @property array<array-key, mixed>|null $readiness_flags
 * @property array<array-key, mixed>|null $collaboration_notes
 * @property array<array-key, mixed>|null $attachments
 * @property string $ai_context_surface
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\ProcurementOpportunity $opportunity
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief whereAiContextSurface($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief whereAttachments($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief whereCollaborationNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief whereExecutiveSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief whereHeadline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief whereImpactMetrics($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief whereMissionObjectives($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief wherePolicyLinks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief whereProblemStatement($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief whereProcurementOpportunityId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief whereReadinessFlags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MissionBrief whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class MissionBrief extends Model
{
    use HasFactory;

    protected $fillable = [
        'procurement_opportunity_id',
        'headline',
        'executive_summary',
        'problem_statement',
        'mission_objectives',
        'policy_links',
        'impact_metrics',
        'readiness_flags',
        'collaboration_notes',
        'attachments',
        'ai_context_surface',
    ];

    protected $casts = [
        'mission_objectives' => 'array',
        'policy_links' => 'array',
        'impact_metrics' => 'array',
        'readiness_flags' => 'array',
        'collaboration_notes' => 'array',
        'attachments' => 'array',
    ];

    public function opportunity(): BelongsTo
    {
        return $this->belongsTo(ProcurementOpportunity::class, 'procurement_opportunity_id');
    }
}
