<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $candidate_id
 * @property \Illuminate\Support\Carbon $analysis_date
 * @property numeric $overall_gap_score
 * @property array<array-key, mixed>|null $skill_gaps
 * @property array<array-key, mixed>|null $market_insights
 * @property array<array-key, mixed>|null $learning_paths
 * @property array<array-key, mixed>|null $top_in_demand_skills
 * @property array<array-key, mixed>|null $skill_improvements
 * @property int $skills_analyzed
 * @property int $skills_matched
 * @property int $skills_gap
 * @property numeric $market_competitiveness
 * @property string|null $career_level
 * @property string|null $ai_recommendations
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Candidate $candidate
 * @property-read string $competitiveness_color
 * @property-read string $competitiveness_level
 * @property-read float $gap_percentage
 * @property-read array $improved_skills
 * @property-read float $match_percentage
 * @property-read array $priority_gaps
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis forCandidate($candidateId)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis recent($days = 30)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereAiRecommendations($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereAnalysisDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereCareerLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereLearningPaths($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereMarketCompetitiveness($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereMarketInsights($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereOverallGapScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereSkillGaps($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereSkillImprovements($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereSkillsAnalyzed($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereSkillsGap($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereSkillsMatched($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereTopInDemandSkills($value)final 
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SkillGapAnalysis whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SkillGapAnalysis extends Model
{
    protected $fillable = [
        'candidate_id',
        'analysis_date',
        'overall_gap_score',
        'skill_gaps',
        'market_insights',
        'learning_paths',
        'top_in_demand_skills',
        'skill_improvements',
        'skills_analyzed',
        'skills_matched',
        'skills_gap',
        'market_competitiveness',
        'career_level',
        'ai_recommendations',
    ];

    protected $casts = [
        'analysis_date' => 'date',
        'overall_gap_score' => 'decimal:2',
        'skill_gaps' => 'array',
        'market_insights' => 'array',
        'learning_paths' => 'array',
        'top_in_demand_skills' => 'array',
        'skill_improvements' => 'array',
        'skills_analyzed' => 'integer',
        'skills_matched' => 'integer',
        'skills_gap' => 'integer',
        'market_competitiveness' => 'decimal:2',
    ];

    /**
     * Get the candidate that owns the analysis
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    /**
     * Get the gap percentage attribute
     */
    public function getGapPercentageAttribute(): float
    {
        if ($this->skills_analyzed == 0) {
            return 0;
        }

        return round(($this->skills_gap / $this->skills_analyzed) * 100, 2);
    }

    /**
     * Get the match percentage attribute
     */
    public function getMatchPercentageAttribute(): float
    {
        if ($this->skills_analyzed == 0) {
            return 0;
        }

        return round(($this->skills_matched / $this->skills_analyzed) * 100, 2);
    }

    /**
     *
     * Get color for competitiveness score
     */
    public function getCompetitivenessColorAttribute(): string
    {
        if ($this->market_competitiveness >= 80) {
            return '#10B981'; // Green - Excellent
        } elseif ($this->market_competitiveness >= 60) {
            return '#F59E0B'; // Orange - Good
        } elseif ($this->market_competitiveness >= 40) {
            return '#EF4444'; // Red - Needs Improvement
        }

        return '#6B7280'; // Gray - Poor
    }

    /**
     *
     * Get competitiveness level label
     */
    public function getCompetitivenessLevelAttribute(): string
    {
        if ($this->market_competitiveness >= 80) {
            return 'Highly Competitive';
        } elseif ($this->market_competitiveness >= 60) {
            return 'Competitive';
        } elseif ($this->market_competitiveness >= 40) {
            return 'Moderately Competitive';
        }

        return 'Needs Improvement';
    }

    /**
     *
     * Get priority skills with gaps
     *
     * @psalm-return list<mixed>
     */
    public function getPriorityGapsAttribute(): array
    {
        if (empty($this->skill_gaps)) {
            return [];
        }

        // Sort by demand and gap size
        $gaps = $this->skill_gaps;
        usort($gaps, function($a, $b) {
            $aDemand = $a['demand_level'] ?? 'low';
            $bDemand = $b['demand_level'] ?? 'low';

            $demandWeight = ['very_high' => 4, 'high' => 3, 'medium' => 2, 'low' => 1];
            $aWeight = ($demandWeight[$aDemand] ?? 0) * ($a['gap_score'] ?? 0);
            $bWeight = ($demandWeight[$bDemand] ?? 0) * ($b['gap_score'] ?? 0);

            return $bWeight <=> $aWeight;
        });

        return array_slice($gaps, 0, 5);
    }

    /**
     * Get skills that have improved
     */
    public function getImprovedSkillsAttribute(): array
    {
        if (empty($this->skill_improvements)) {
            return [];
        }

        return array_filter($this->skill_improvements, function($skill) {
            return ($skill['improvement_score'] ?? 0) > 0;
        });
    }

    /**
     * Scope to get recent analyses
     */
    public function scopeRecent($query, $days = 30)
    {
        return $query->where('analysis_date', '>=', now()->subDays($days));
    }

    /**
     * Scope to get analyses for a candidate
     */
    public function scopeForCandidate($query, $candidateId)
    {
        return $query->where('candidate_id', $candidateId);
    }
}
