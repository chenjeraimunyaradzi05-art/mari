<?php

namespace App\Models\Pathways;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $pathway_phase_id
 * @property string|null $milestone_type
 * @property int $sequence
 * @property string $title
 * @property string|null $description
 * @property \Illuminate\Support\Carbon|null $due_on
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $due_date
 * @property \Illuminate\Support\Carbon|null $completed_at
 * @property array<array-key, mixed>|null $evidence_data
 * @property int $progress
 * @property string|null $blockers
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property string|null $linkable_type
 * @property int|null $linkable_id
 * @property-read \App\Models\Pathways\PathwayPhase $phase
 * @method static \Database\Factories\Pathways\PathwayMilestoneFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereBlockers($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereDueDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereDueOn($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereEvidenceData($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereLinkableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereLinkableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereMilestoneType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone wherePathwayPhaseId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereProgress($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereSequence($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayMilestone whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class PathwayMilestone extends Model
{
    use HasFactory;

    protected $fillable = [
        'pathway_phase_id',
        'sequence',
        'milestone_type',
        'title',
        'description',
        'due_on',
        'due_date',
        'status',
        'progress',
        'blockers',
        'metadata',
        'completed_at',
        'evidence_data',
    ];

    protected $casts = [
        'due_on' => 'date',
        'due_date' => 'date',
        'metadata' => 'array',
        'evidence_data' => 'array',
        'completed_at' => 'datetime',
    ];

    public function phase(): BelongsTo
    {
        return $this->belongsTo(PathwayPhase::class, 'pathway_phase_id');
    }
}

