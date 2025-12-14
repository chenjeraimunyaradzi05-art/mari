<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Enums\WomenRealEstate\CohortPersona;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property CohortPersona|null $persona
 * @property array<array-key, mixed>|null $layout
 * @property array<array-key, mixed>|null $settings
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenDashboardWidget> $pinnedWidgets
 * @property int|null pinned_widgets_count
 * @property-read User $user
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenDashboardWidget> $widgets
 * @property int|null widgets_count
 * @method static \Database\Factories\WomenRealEstate\WomenDashboardPreferenceFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardPreference newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardPreference newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardPreference query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardPreference whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardPreference whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardPreference whereLayout($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardPreference wherePersona($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardPreference whereSettings($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardPreference whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenDashboardPreference whereUserId($value)
 * @mixin \Eloquent
 */
final class WomenDashboardPreference extends Model
{
    use HasFactory;

    protected $table = 'women_dashboard_preferences';

    protected $fillable = [
        'user_id',
        'persona',
        'layout',
        'settings',
    ];

    protected $casts = [
        'persona' => CohortPersona::class,
        'layout' => 'array',
        'settings' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function widgets(): HasMany
    {
        return $this->hasMany(WomenDashboardWidget::class, 'preference_id');
    }

    public function pinnedWidgets(): HasMany
    {
        return $this->widgets()->where('pinned', true)->orderBy('position');
    }
}

