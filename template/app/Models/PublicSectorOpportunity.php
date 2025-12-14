<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int|null $public_sector_agency_id
 * @property int|null $public_sector_program_id
 * @property string $title
 * @property string $slug
 * @property string|null $role_level
 * @property string|null $work_arrangement
 * @property string|null $location
 * @property string|null $salary_band
 * @property \Illuminate\Support\Carbon|null $closes_at
 * @property string|null $application_url
 * @property array<array-key, mixed>|null $tags
 * @property string|null $summary
 * @property string|null $impact_statement
 * @property string|null $ai_signal
 * @property bool $is_featured
 * @property int $priority_score
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\PublicSectorAgency|null $agency
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PublicSectorEngagement> $engagements
 * @property int|null engagements_count
 * @property-read string|null $closing_window
 * @property-read \App\Models\PublicSectorProgram|null $program
 *
 * @method static \Database\Factories\PublicSectorOpportunityFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity featured()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity open()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereAiSignal($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereApplicationUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereClosesAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereImpactStatement($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereIsFeatured($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity wherePriorityScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity wherePublicSectorAgencyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity wherePublicSectorProgramId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereRoleLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereSalaryBand($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorOpportunity whereWorkArrangement($value)
 *
 * @mixin \Eloquent
 */
final class PublicSectorOpportunity extends Model
{
    use HasFactory;

    protected $fillable = [
        'public_sector_agency_id',
        'public_sector_program_id',
        'title',
        'slug',
        'role_level',
        'work_arrangement',
        'location',
        'salary_band',
        'closes_at',
        'application_url',
        'tags',
        'summary',
        'impact_statement',
        'ai_signal',
        'is_featured',
        'priority_score',
        'status',
    ];

    protected $casts = [
        'tags' => 'array',
        'is_featured' => 'boolean',
        'closes_at' => 'date',
    ];

    protected $appends = ['closing_window'];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (self $opportunity): void {
            if (empty($opportunity->slug)) {
                $opportunity->slug = Str::slug($opportunity->title).'-'.Str::lower(Str::random(4));
            }
        });
    }

    /**
     * @psalm-return 'slug'
     */
    #[\Override]
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(PublicSectorAgency::class, 'public_sector_agency_id');
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(PublicSectorProgram::class, 'public_sector_program_id');
    }

    public function engagements(): HasMany
    {
        return $this->hasMany(PublicSectorEngagement::class);
    }

    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }

    public function scopeOpen($query)
    {
        return $query->where('status', 'open');
    }

    public function getClosingWindowAttribute(): ?string
    {
        if (! $this->closes_at) {
            return null;
        }

        $deadlineDate = $this->closes_at->copy()->startOfDay();
        $today = now()->copy()->startOfDay();
        $days = $today->diffInDays($deadlineDate, false);

        if ($days < 0) {
            return 'Closed';
        }

        if ($days === 0) {
            return 'Closes today';
        }

        if ($days === 1) {
            return 'Closes in 1 day';
        }

        return 'Closes in '.$days.' days';
    }
}
