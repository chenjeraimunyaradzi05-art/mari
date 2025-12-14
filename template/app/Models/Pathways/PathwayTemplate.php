<?php

namespace App\Models\Pathways;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $pathway_type
 * @property string $template_name
 * @property string|null $description
 * @property string|null $target_audience
 * @property int|null $partner_id
 * @property array<array-key, mixed> $phases_json
 * @property int $usage_count
 * @property numeric|null $success_rate
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @method static \Database\Factories\Pathways\PathwayTemplateFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate wherePartnerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate wherePathwayType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate wherePhasesJson($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate whereSuccessRate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate whereTargetAudience($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate whereTemplateName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PathwayTemplate whereUsageCount($value)
 * @mixin \Eloquent
 */
final class PathwayTemplate extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'phases_json' => 'array',
        'success_rate' => 'decimal:2',
    ];
}

