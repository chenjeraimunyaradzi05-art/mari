<?php

namespace App\Services;

use App\Models\Candidate;
use App\Models\SkillGapAnalysis;
use App\Models\LearningResource;
use App\Models\SkillDemandData;
use App\Models\CandidateLearningProgress;
use App\Models\Skill;
use App\Models\Job;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class SkillGapService
{
    /**
     * Analyze skill gaps for a candidate
     */
    public function analyzeSkillGaps(Candidate $candidate): SkillGapAnalysis
    {
        // Get candidate's current skills
        $candidateSkills = $candidate->skills()->pluck('skills.id')->toArray();

        // Get market demand data
        $marketSkills = $this->getMarketDemandSkills();

        // Calculate gaps
        $skillGaps = [];
        $skillsMatched = 0;
        $skillsAnalyzed = count($marketSkills);

        foreach ($marketSkills as $marketSkill) {
            $hasSkill = in_array($marketSkill['skill_id'], $candidateSkills);

            if ($hasSkill) {
                $skillsMatched++;
            } else {
                $skillGaps[] = [
                    'skill_id' => $marketSkill['skill_id'],
                    'skill_name' => $marketSkill['skill_name'],
                    'demand_level' => $marketSkill['demand_level'],
                    'job_count' => $marketSkill['job_count'],
                    'avg_salary' => $marketSkill['avg_salary'],
                    'growth_rate' => $marketSkill['growth_rate'],
                    'gap_score' => $this->calculateGapScore($marketSkill),
                    'priority' => $this->calculatePriority($marketSkill),
                ];
            }
        }

        // Calculate overall scores
        $overallGapScore = $skillsAnalyzed > 0
            ? round((count($skillGaps) / $skillsAnalyzed) * 100, 2)
            : 0;

        $marketCompetitiveness = 100 - $overallGapScore;

        // Get market insights
        $marketInsights = $this->getMarketInsights($candidate, $skillGaps);

        // Generate learning paths
        $learningPaths = $this->generateLearningPaths($skillGaps);

        // Get top in-demand skills
        $topInDemandSkills = $this->getTopInDemandSkills(10);

        // Get skill improvements (compare with previous analysis)
        $skillImprovements = $this->getSkillImprovements($candidate);

        // Determine career level based on skills
        $careerLevel = $this->determineCareerLevel($candidate, $skillsMatched, $skillsAnalyzed);

        // Generate AI recommendations
        $aiRecommendations = $this->generateAIRecommendations($candidate, $skillGaps, $marketInsights);

        // Create or update analysis
        $analysis = SkillGapAnalysis::updateOrCreate(
            [
                'candidate_id' => $candidate->id,
                'analysis_date' => now()->toDateString(),
            ],
            [
                'overall_gap_score' => $overallGapScore,
                'skill_gaps' => $skillGaps,
                'market_insights' => $marketInsights,
                'learning_paths' => $learningPaths,
                'top_in_demand_skills' => $topInDemandSkills,
                'skill_improvements' => $skillImprovements,
                'skills_analyzed' => $skillsAnalyzed,
                'skills_matched' => $skillsMatched,
                'skills_gap' => count($skillGaps),
                'market_competitiveness' => $marketCompetitiveness,
                'career_level' => $careerLevel,
                'ai_recommendations' => $aiRecommendations,
            ]
        );

        return $analysis->fresh();
    }

    /**
     * Get market demand skills with data
     */
    protected function getMarketDemandSkills(): array
    {
        return SkillDemandData::with('skill')
            ->latest()
            ->highDemand()
            ->take(50)
            ->get()
            ->map(function($demandData) {
                return [
                    'skill_id' => $demandData->skill_id,
                    'skill_name' => $demandData->skill->name,
                    'demand_level' => $demandData->demand_level,
                    'job_count' => $demandData->job_count,
                    'avg_salary' => $demandData->avg_salary,
                    'growth_rate' => $demandData->growth_rate,
                    'demand_rank' => $demandData->demand_rank,
                ];
            })
            ->toArray();
    }

    /**
     * Calculate gap score for a skill
     */
    protected function calculateGapScore(array $skillData): float
    {
        $demandWeight = match($skillData['demand_level']) {
            'very_high' => 40,
            'high' => 30,
            'medium' => 20,
            'low' => 10,
            default => 0,
        };

        $jobCountWeight = min(30, ($skillData['job_count'] / 100) * 30);
        $growthWeight = min(30, max(0, $skillData['growth_rate'] * 3));

        return round($demandWeight + $jobCountWeight + $growthWeight, 2);
    }

    /**
     * Calculate priority for a skill gap
     */
    protected function calculatePriority(array $skillData): string
    {
        $score = $this->calculateGapScore($skillData);

        if ($score >= 80) {
            return 'critical';
        } elseif ($score >= 60) {
            return 'high';
        } elseif ($score >= 40) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * Get market insights
     *
     * @return (array|float|int|mixed)[]
     *
     * @psalm-return array{total_opportunities: mixed, matched_jobs: mixed, potential_salary_increase: 0|float, trending_skills: array<int, mixed>, industry_demand: array<int, mixed>, location_hotspots: array<int, mixed>}
     */
    protected function getMarketInsights(Candidate $candidate, array $skillGaps): array
    {
        $insights = [
            'total_opportunities' => Job::active()->count(),
            'matched_jobs' => 0,
            'potential_salary_increase' => 0,
            'trending_skills' => [],
            'industry_demand' => [],
            'location_hotspots' => [],
        ];

        // Calculate matched jobs based on candidate skills
        $candidateSkillIds = $candidate->skills()->pluck('skills.id');
        $insights['matched_jobs'] = Job::active()
            ->whereHas('skills', function($query) use ($candidateSkillIds) {
                $query->whereIn('skills.id', $candidateSkillIds);
            })
            ->count();

        // Calculate potential salary increase
        if (!empty($skillGaps)) {
            $potentialIncrease = collect($skillGaps)
                ->where('priority', 'critical')
                ->sum('avg_salary');
            $insights['potential_salary_increase'] = round($potentialIncrease * 0.15, 2);
        }

        // Get trending skills (high growth rate)
        $insights['trending_skills'] = SkillDemandData::latest()
            ->where('growth_rate', '>', 10)
            ->with('skill')
            ->take(5)
            ->get()
            ->map(function($data) {
                return [
                    'name' => $data->skill->name,
                    'growth_rate' => $data->growth_rate,
                ];
            })
            ->toArray();

        // Get industry demand
        $insights['industry_demand'] = DB::table('jobs')
            ->join('industry_types', 'jobs.industry_type_id', '=', 'industry_types.id')
            ->select('industry_types.name', DB::raw('COUNT(*) as job_count'))
            ->groupBy('industry_types.name')
            ->orderByDesc('job_count')
            ->take(5)
            ->get()
            ->toArray();

        // Get location hotspots
        $insights['location_hotspots'] = DB::table('jobs')
            ->join('cities', 'jobs.city_id', '=', 'cities.id')
            ->select('cities.name', DB::raw('COUNT(*) as job_count'))
            ->groupBy('cities.name')
            ->orderByDesc('job_count')
            ->take(5)
            ->get()
            ->toArray();

        return $insights;
    }

    /**
     * Generate learning paths for skill gaps
     *
     * @return (array|string)[][]
     *
     * @psalm-return list{0?: array{name: 'Career Accelerator'|'Foundation Builder'|'Specialist Track', level: 'advanced'|'beginner'|'intermediate', duration: '12-18 months'|'3-6 months'|'6-12 months', skills: array, description: 'Advance your skillset to compete for better opportunities'|'Build core skills that are in high demand'|'Master specialized skills for leadership roles', estimated_impact: 'Career Transformation'|'High'|'Very High'}, 1?: array{name: 'Career Accelerator'|'Specialist Track', level: 'advanced'|'intermediate', duration: '12-18 months'|'6-12 months', skills: array, description: 'Advance your skillset to compete for better opportunities'|'Master specialized skills for leadership roles', estimated_impact: 'Career Transformation'|'Very High'}, 2?: array{name: 'Specialist Track', level: 'advanced', duration: '12-18 months', skills: array, description: 'Master specialized skills for leadership roles', estimated_impact: 'Career Transformation'}}
     */
    protected function generateLearningPaths(array $skillGaps): array
    {
        $paths = [];

        // Group by priority
        $criticalGaps = array_filter($skillGaps, fn($gap) => $gap['priority'] === 'critical');
        $highGaps = array_filter($skillGaps, fn($gap) => $gap['priority'] === 'high');

        // Create beginner path
        if (!empty($criticalGaps)) {
            $paths[] = [
                'name' => 'Foundation Builder',
                'level' => 'beginner',
                'duration' => '3-6 months',
                'skills' => array_slice($criticalGaps, 0, 3),
                'description' => 'Build core skills that are in high demand',
                'estimated_impact' => 'High',
            ];
        }

        // Create intermediate path
        if (!empty($highGaps)) {
            $paths[] = [
                'name' => 'Career Accelerator',
                'level' => 'intermediate',
                'duration' => '6-12 months',
                'skills' => array_slice($highGaps, 0, 5),
                'description' => 'Advance your skillset to compete for better opportunities',
                'estimated_impact' => 'Very High',
            ];
        }

        // Create specialized path
        if (count($skillGaps) >= 5) {
            $specializedSkills = array_slice($skillGaps, 0, 5);
            $paths[] = [
                'name' => 'Specialist Track',
                'level' => 'advanced',
                'duration' => '12-18 months',
                'skills' => $specializedSkills,
                'description' => 'Master specialized skills for leadership roles',
                'estimated_impact' => 'Career Transformation',
            ];
        }

        return $paths;
    }

    /**
     * Get top in-demand skills
     */
    protected function getTopInDemandSkills(int $limit = 10): array
    {
        return SkillDemandData::with('skill')
            ->latest()
            ->highDemand()
            ->take($limit)
            ->get()
            ->map(function($data) {
                return [
                    'skill_id' => $data->skill_id,
                    'name' => $data->skill->name,
                    'demand_level' => $data->demand_level,
                    'job_count' => $data->job_count,
                    'growth_rate' => $data->growth_rate,
                ];
            })
            ->toArray();
    }

    /**
     * Get skill improvements over time
     *
     * @return (int|mixed|string)[][]
     *
     * @psalm-return list{0?: array{skill_id: mixed, skill_name: mixed, improved_at: string, improvement_score: 10},...}
     */
    protected function getSkillImprovements(Candidate $candidate): array
    {
        $previousAnalysis = SkillGapAnalysis::forCandidate($candidate->id)
            ->where('analysis_date', '<', now()->toDateString())
            ->orderByDesc('analysis_date')
            ->first();

        if (!$previousAnalysis) {
            return [];
        }

        $currentSkills = $candidate->skills()->pluck('skills.id')->toArray();
        $previousGaps = collect($previousAnalysis->skill_gaps)->pluck('skill_id')->toArray();

        $improvements = [];
        foreach ($previousGaps as $skillId) {
            if (in_array($skillId, $currentSkills)) {
                $skill = Skill::find($skillId);
                $improvements[] = [
                    'skill_id' => $skillId,
                    'skill_name' => $skill->name,
                    'improved_at' => now()->toDateString(),
                    'improvement_score' => 10,
                ];
            }
        }

        return $improvements;
    }

    /**
     * Determine career level
     */
    protected function determineCareerLevel(Candidate $candidate, int $skillsMatched, int $skillsAnalyzed): string
    {
        $matchPercentage = $skillsAnalyzed > 0 ? ($skillsMatched / $skillsAnalyzed) * 100 : 0;

        if ($matchPercentage >= 80) {
            return 'Expert';
        } elseif ($matchPercentage >= 60) {
            return 'Advanced';
        } elseif ($matchPercentage >= 40) {
            return 'Intermediate';
        } elseif ($matchPercentage >= 20) {
            return 'Developing';
        }

        return 'Entry Level';
    }

    /**
     * Generate AI recommendations
     */
    protected function generateAIRecommendations(Candidate $candidate, array $skillGaps, array $marketInsights): string
    {
        $recommendations = [];

        // Analyze competitiveness
        $gapCount = count($skillGaps);
        if ($gapCount > 20) {
            $recommendations[] = "🎯 Focus on building foundational skills first. Start with 3-5 critical skills to make immediate impact.";
        } elseif ($gapCount > 10) {
            $recommendations[] = "📈 You're on the right track! Prioritize high-demand skills to maximize job opportunities.";
        } else {
            $recommendations[] = "🌟 Excellent skill profile! Consider specialized certifications to stand out from competition.";
        }

        // Market opportunity
        $matchedJobs = $marketInsights['matched_jobs'] ?? 0;
        $totalJobs = $marketInsights['total_opportunities'] ?? 1;
        $matchRate = ($matchedJobs / $totalJobs) * 100;

        if ($matchRate < 10) {
            $recommendations[] = "💼 Only {$matchedJobs} jobs match your skills. Learning new skills could unlock {$totalJobs}+ opportunities.";
        } elseif ($matchRate < 30) {
            $recommendations[] = "🚀 You currently match {$matchedJobs} jobs. Closing skill gaps could double your opportunities.";
        } else {
            $recommendations[] = "✨ Great market fit with {$matchedJobs}+ matching opportunities. Keep your skills updated to maintain competitiveness.";
        }

        // Salary potential
        $salaryIncrease = $marketInsights['potential_salary_increase'] ?? 0;
        if ($salaryIncrease > 10000) {
            $recommendations[] = "💰 Learning critical skills could increase your earning potential by $" . number_format($salaryIncrease, 0) . "+";
        }

        // Learning recommendation
        if ($gapCount > 0) {
            $criticalCount = collect($skillGaps)->where('priority', 'critical')->count();
            if ($criticalCount > 0) {
                $recommendations[] = "📚 We've identified {$criticalCount} critical skills to learn. Start with online courses and practice projects.";
            }
        }

        // Time investment
        $recommendations[] = "⏰ Dedicate 5-10 hours per week to learning. Consistency is key to skill development.";

        return implode("\n\n", $recommendations);
    }

    /**
     * Get learning resources for a skill
     */
    public function getLearningResources(int $skillId, array $filters = []): Collection
    {
        $query = LearningResource::where('skill_id', $skillId)
            ->active();

        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (isset($filters['difficulty'])) {
            $query->where('difficulty', $filters['difficulty']);
        }

        if (isset($filters['free']) && $filters['free']) {
            $query->where('price', 0);
        }

        if (isset($filters['certified']) && $filters['certified']) {
            $query->where('is_certified', true);
        }

        return $query->orderByDesc('is_featured')
            ->orderByDesc('rating')
            ->orderByDesc('enrollments')
            ->get();
    }

    /**
     * Start learning resource
     */
    public function startLearning(Candidate $candidate, LearningResource $resource): CandidateLearningProgress
    {
        $progress = CandidateLearningProgress::firstOrCreate(
            [
                'candidate_id' => $candidate->id,
                'learning_resource_id' => $resource->id,
            ],
            [
                'skill_id' => $resource->skill_id,
                'status' => 'not_started',
                'progress_percentage' => 0,
            ]
        );

        if ($progress->status === 'not_started') {
            $progress->markAsStarted();
            $resource->incrementEnrollments();
        }

        return $progress->fresh();
    }

    /**
     * Get candidate's learning stats
     *
     * @return (float|int|mixed)[]
     *
     * @psalm-return array{total_resources: int, completed: int, in_progress: int, total_time_spent: mixed, skills_learning: int, completion_rate: 0|float, avg_rating: float|int}
     */
    public function getLearningStats(Candidate $candidate): array
    {
        $progress = CandidateLearningProgress::forCandidate($candidate->id)->get();

        return [
            'total_resources' => $progress->count(),
            'completed' => $progress->where('status', 'completed')->count(),
            'in_progress' => $progress->where('status', 'in_progress')->count(),
            'total_time_spent' => $progress->sum('time_spent'),
            'skills_learning' => $progress->pluck('skill_id')->unique()->count(),
            'completion_rate' => $progress->count() > 0
                ? round(($progress->where('status', 'completed')->count() / $progress->count()) * 100, 2)
                : 0,
            'avg_rating' => $progress->whereNotNull('rating')->avg('rating') ?? 0,
        ];
    }

    /**
     * Get recommended resources for candidate
     */
    public function getRecommendedResources(Candidate $candidate, int $limit = 10): Collection
    {
        $analysis = SkillGapAnalysis::forCandidate($candidate->id)
            ->orderByDesc('analysis_date')
            ->first();

        if (!$analysis || empty($analysis->skill_gaps)) {
            return collect();
        }

        // Get skill IDs from gaps (prioritize critical and high)
        $prioritySkills = collect($analysis->skill_gaps)
            ->whereIn('priority', ['critical', 'high'])
            ->pluck('skill_id')
            ->take(5)
            ->toArray();

        return LearningResource::whereIn('skill_id', $prioritySkills)
            ->active()
            ->where(function($query) {
                $query->where('is_featured', true)
                    ->orWhere('rating', '>=', 4.0);
            })
            ->orderByDesc('is_featured')
            ->orderByDesc('rating')
            ->take($limit)
            ->get();
    }
}

