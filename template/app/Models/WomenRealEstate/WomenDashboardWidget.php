<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $preference_id
 * @property \App\Enums\WomenRealEstate\DashboardWidgetType $widget
 * @property int $position
 * @property bool $pinned
 * @property array<array-key, mixed>|null $config
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenRealEstate\WomenDashboardPreference $preference
 * @method static \Database\Factories\WomenRealEstate\WomenDashboardWidgetFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardWidget newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardWidget newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardWidget ordered()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardWidget query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardWidget whereConfig($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardWidget whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardWidget whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardWidget wherePinned($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardWidget wherePosition($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardWidget wherePreferenceId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardWidget whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardWidget whereWidget($value)
 * @mixin \Eloquent
 */
final class WomenDashboardWidget extends Model
{
    use HasFactory;

    protected $table = 'women_dashboard_widgets';

    protected $fillable = [
        'preference_id',
        'widget',
        'position',
        'pinned',
        'config',
    ];

    protected $casts = [
        'widget' => \App\Enums\WomenRealEstate\DashboardWidgetType::class,
        'pinned' => 'bool',
        'config' => 'array',
    ];

    public function preference(): BelongsTo
    {
        return $this->belongsTo(WomenDashboardPreference::class, 'preference_id');
    }

    /**
     * @psalm-return \Illuminate\Database\Eloquent\Builder<Model>
     */
    public function scopeOrdered(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->orderBy('position');
    }
}

