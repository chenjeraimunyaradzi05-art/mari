<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $procurement_opportunity_id
 * @property int|null $owner_id
 * @property string $title
 * @property string $status
 * @property array<array-key, mixed>|null $checklist
 * @property array<array-key, mixed>|null $evidence_links
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $due_at
 * @property \Illuminate\Support\Carbon|null $completed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read bool $is_overdue
 * @property-read \App\Models\ProcurementOpportunity $opportunity
 * @property-read \App\Models\User|null $owner
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker whereChecklist($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker whereDueAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker whereEvidenceLinks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker whereOwnerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker whereProcurementOpportunityId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceTracker whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class ComplianceTracker extends Model
{
    use HasFactory;

    protected $fillable = [
        'procurement_opportunity_id',
        'owner_id',
        'title',
        'status',
        'checklist',
        'evidence_links',
        'metadata',
        'due_at',
        'completed_at',
    ];

    protected $casts = [
        'checklist' => 'array',
        'evidence_links' => 'array',
        'metadata' => 'array',
        'due_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function opportunity(): BelongsTo
    {
        return $this->belongsTo(ProcurementOpportunity::class, 'procurement_opportunity_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function getIsOverdueAttribute(): bool
    {
        return $this->status !== 'complete'
            && $this->due_at !== null
            && $this->due_at->isPast();
    }
}
