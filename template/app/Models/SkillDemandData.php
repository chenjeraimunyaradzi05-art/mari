<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $skill_id
 * @property int $job_count
 * @property numeric|null $avg_salary
 * @property numeric $growth_rate
 * @property string $demand_level
 * @property int|null $demand_rank
 * @property array<array-key, mixed>|null $top_industries
 * @property array<array-key, mixed>|null $top_locations
 * @property array<array-key, mixed>|null $related_skills
 * @property \Illuminate\Support\Carbon $data_date
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read string $demand_badge
 * @property-read string $demand_color
 * @property-read string $formatted_salary
 * @property-read string $growth_color
 * @property-read string $growth_indicator
 * @property-read \App\Models\Skill $skill
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData highDemand()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData latest()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData recent($days = 30)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData whereAvgSalary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData whereDataDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData whereDemandLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData whereDemandRank($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData whereGrowthRate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData whereJobCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData whereRelatedSkills($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData whereSkillId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData whereTopIndustries($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData whereTopLocations($value)final 
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillDemandData whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SkillDemandData extends Model
{
    protected $fillable = [
        'skill_id',
        'job_count',
        'avg_salary',
        'growth_rate',
        'demand_level',
        'demand_rank',
        'top_industries',
        'top_locations',
        'related_skills',
        'data_date',
    ];

    protected $casts = [
        'job_count' => 'integer',
        'avg_salary' => 'decimal:2',
        'growth_rate' => 'decimal:2',
        'demand_rank' => 'integer',
        'top_industries' => 'array',
        'top_locations' => 'array',
        'related_skills' => 'array',
        'data_date' => 'date',
    ];

    /**
     * Get the skill that this data belongs to
     */
    public function skill(): BelongsTo
    {
        return $this->belongsTo(Skill::class);
    }

    /**
     *
     * Get formatted salary
     */
    public function getFormattedSalaryAttribute(): string
    {
        if (!$this->avg_salary) {
            return 'N/A';
        }

        return '$' . number_format($this->avg_salary, 0);
    }

    /**
     *
     * Get demand color
     */
    public function getDemandColorAttribute(): string
    {
        return match($this->demand_level) {
            'very_high' => '#10B981',
            'high' => '#34D399',
            'medium' => '#F59E0B',
            'low' => '#EF4444',
            default => '#6B7280',
        };
    }

    /**
     *
     * Get demand badge
     */
    public function getDemandBadgeAttribute(): string
    {
        return match($this->demand_level) {
            'very_high' => 'Very High Demand',
            'high' => 'High Demand',
            'medium' => 'Medium Demand',
            'low' => 'Low Demand',
            default => 'Unknown',
        };
    }

    /**
     *
     * Get growth indicator
     */
    public function getGrowthIndicatorAttribute(): string
    {
        if ($this->growth_rate > 10) {
            return 'Rapidly Growing';
        } elseif ($this->growth_rate > 5) {
            return 'Growing';
        } elseif ($this->growth_rate > 0) {
            return 'Stable';
        } elseif ($this->growth_rate > -5) {
            return 'Declining';
        }

        return 'Rapidly Declining';
    }

    /**
     *
     * Get growth color
     */
    public function getGrowthColorAttribute(): string
    {
        if ($this->growth_rate > 5) {
            return '#10B981';
        } elseif ($this->growth_rate > 0) {
            return '#34D399';
        } elseif ($this->growth_rate > -5) {
            return '#F59E0B';
        }

        return '#EF4444';
    }

    /**
     * Scope for high demand skills
     */
    public function scopeHighDemand($query)
    {
        return $query->whereIn('demand_level', ['high', 'very_high']);
    }

    /**
     * Scope for recent data
     */
    public function scopeRecent($query, $days = 30)
    {
        return $query->where('data_date', '>=', now()->subDays($days));
    }

    /**
     * Scope for latest data per skill
     */
    public function scopeLatest($query)
    {
        return $query->whereIn('id', function($subQuery) {
            $subQuery->selectRaw('MAX(id)')
                ->from('skill_demand_data')
                ->groupBy('skill_id');
        });
    }
}
