<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Enums\WomenRealEstate\PartnerProjectStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $owner_id
 * @property string $title
 * @property string $slug
 * @property PartnerProjectStatus $status
 * @property string|null $summary
 * @property array<array-key, mixed>|null $capital_stack
 * @property array<array-key, mixed>|null $ai_insights
 * @property \Illuminate\Support\Carbon|null $target_launch_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenPartnerMatch> $matches
 * @property int|null matches_count
 * @property-read User $owner
 * @method static Builder<static>|WomenPartnerProject active()
 * @method static \Database\Factories\WomenRealEstate\WomenPartnerProjectFactory factory($count = null, $state = [])
 * @method static Builder<static>|WomenPartnerProject newModelQuery()
 * @method static Builder<static>|WomenPartnerProject newQuery()
 * @method static Builder<static>|WomenPartnerProject query()
 * @method static Builder<static>|WomenPartnerProject whereAiInsights($value)
 * @method static Builder<static>|WomenPartnerProject whereCapitalStack($value)
 * @method static Builder<static>|WomenPartnerProject whereCreatedAt($value)
 * @method static Builder<static>|WomenPartnerProject whereId($value)
 * @method static Builder<static>|WomenPartnerProject whereOwnerId($value)
 * @method static Builder<static>|WomenPartnerProject whereSlug($value)
 * @method static Builder<static>|WomenPartnerProject whereStatus($value)
 * @method static Builder<static>|WomenPartnerProject whereSummary($value)
 * @method static Builder<static>|WomenPartnerProject whereTargetLaunchAt($value)
 * @method static Builder<static>|WomenPartnerProject whereTitle($value)
 * @method static Builder<static>|WomenPartnerProject whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WomenPartnerProject extends Model
{
    use HasFactory;

    protected $table = 'women_partner_projects';

    protected $fillable = [
        'owner_id',
        'title',
        'slug',
        'status',
        'summary',
        'capital_stack',
        'ai_insights',
        'target_launch_at',
    ];

    protected $casts = [
        'status' => PartnerProjectStatus::class,
        'capital_stack' => 'array',
        'ai_insights' => 'array',
        'target_launch_at' => 'datetime',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function matches(): HasMany
    {
        return $this->hasMany(WomenPartnerMatch::class, 'project_id');
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', [
            PartnerProjectStatus::SEEKING_PARTNERS->value,
            PartnerProjectStatus::ACTIVE->value,
        ]);
    }
}

