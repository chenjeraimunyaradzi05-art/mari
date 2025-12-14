<?php

namespace App\Models\Pathways;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $pathway_id
 * @property string $outcome_type
 * @property numeric|null $outcome_value
 * @property string|null $outcome_description
 * @property \Illuminate\Support\Carbon|null $verified_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Pathways\LifePathway $pathway
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayOutcome newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayOutcome newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayOutcome query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayOutcome whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayOutcome whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayOutcome whereOutcomeDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayOutcome whereOutcomeType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayOutcome whereOutcomeValue($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayOutcome wherePathwayId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayOutcome whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayOutcome whereVerifiedAt($value)
 * @mixin \Eloquent
 */
final class PathwayOutcome extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'outcome_value' => 'decimal:2',
        'verified_at' => 'datetime',
    ];

    public function pathway(): BelongsTo
    {
        return $this->belongsTo(LifePathway::class, 'pathway_id');
    }
}

