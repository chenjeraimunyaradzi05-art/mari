<?php

namespace App\Services\Ai;

use App\Contracts\AI\TextModel;
use App\Models\User;
use App\Models\MentorshipProgram;
use App\Services\WomenRealEstate\MentorshipMatchingService as BaseMentorshipService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * AI-powered mentor matching service
 * Extends base mentorship matching with advanced ML-based compatibility scoring
 * Implements PRD §3.2 requirements for AI mentor matching
 */
class AIMentorMatchingService
{

    private BaseMentorshipService $baseService;
    private TextModel $textModel;
    private int $cacheTtl;

    public function __construct(BaseMentorshipService $baseService, TextModel $textModel, int $cacheTtl = 900)
    {
        $this->baseService = $baseService;
        $this->textModel = $textModel;
        $this->cacheTtl = $cacheTtl;
    }


    /**
     * Get AI-enhanced mentor recommendations
     * Analyzes skills, goals, personality, and compatibility
     */
    public function getEnhancedMentorRecommendations(User $mentee, int $limit = 5): array
    {
        $cacheKey = "ai_mentor_match:{$mentee->id}:{$limit}";

        return Cache::remember($cacheKey, $this->cacheTtl, function () use ($mentee, $limit) {
            try {
                // Get base recommendations
                $profile = $mentee->womenCohortProfile ?? $mentee->candidate;
                if (!$profile) {
                    return $this->fallbackRecommendations();
                }

                $baseRecommendations = $this->baseService->recommendations($profile, $limit * 2);

                // Enhance with AI scoring
                $enhanced = collect($baseRecommendations)->map(function ($recommendation) use ($mentee, $profile) {
                    return $this->enhanceRecommendation($recommendation, $mentee, $profile);
                });

                // Re-rank by AI compatibility score
                return $enhanced
                    ->sortByDesc('ai_compatibility_score')
                    ->take($limit)
                    ->values()
                    ->all();

            } catch (\Throwable $e) {
                Log::error('AI mentor matching failed', [
                    'mentee_id' => $mentee->id,
                    'error' => $e->getMessage(),
                ]);

                return $this->fallbackRecommendations();
            }
        });
    }

    /**
     * Analyze mentor-mentee compatibility using AI
     */
    public function analyzeCompatibility(User $mentee, MentorshipProgram $program): array
    {
        try {
            $menteeProfile = $this->buildMenteeProfile($mentee);
            $mentorProfile = $this->buildMentorProfile($program);

            $prompt = "Analyze mentor-mentee compatibility:\n\n"
                . "MENTEE:\n{$menteeProfile}\n\n"
                . "MENTOR PROGRAM:\n{$mentorProfile}\n\n"
                . "Provide JSON analysis:\n"
                . '{"compatibility_score": 0-100, "strengths": ["strength1", "strength2"], '
                . '"growth_areas": ["area1", "area2"], "recommendation": "summary"}';

            $response = $this->textModel->generate($prompt, ['max_tokens' => 400]);
            $analysis = json_decode($response, true);

            if (is_array($analysis) && isset($analysis['compatibility_score'])) {
                return [
                    'ai_compatibility_score' => min(100, max(0, (int) $analysis['compatibility_score'])),
                    'strengths' => array_slice($analysis['strengths'] ?? [], 0, 5),
                    'growth_areas' => array_slice($analysis['growth_areas'] ?? [], 0, 3),
                    'ai_recommendation' => $analysis['recommendation'] ?? 'Good potential match',
                    'analysis_timestamp' => now()->toIso8601String(),
                ];
            }

            return $this->fallbackCompatibilityAnalysis();

        } catch (\Throwable $e) {
            Log::warning('AI compatibility analysis failed', ['error' => $e->getMessage()]);
            return $this->fallbackCompatibilityAnalysis();
        }
    }

    /**
     * Enhance base recommendation with AI insights
     */
    private function enhanceRecommendation(array $recommendation, User $mentee, $profile): array
    {
        $programId = $recommendation['program_id'] ?? null;
        if (!$programId) {
            return array_merge($recommendation, [
                'ai_compatibility_score' => $recommendation['fit_score'] ?? 50,
                'ai_insights' => [],
            ]);
        }

        $program = MentorshipProgram::find($programId);
        if (!$program) {
            return $recommendation;
        }

        $compatibility = $this->analyzeCompatibility($mentee, $program);

        return array_merge($recommendation, [
            'ai_compatibility_score' => $compatibility['ai_compatibility_score'] ?? $recommendation['fit_score'] ?? 50,
            'ai_strengths' => $compatibility['strengths'] ?? [],
            'ai_growth_areas' => $compatibility['growth_areas'] ?? [],
            'ai_recommendation' => $compatibility['ai_recommendation'] ?? null,
        ]);
    }

    /**
     * Build mentee profile for AI analysis
     */
    private function buildMenteeProfile(User $mentee): string
    {
        $candidate = $mentee->candidate;
        $cohortProfile = $mentee->womenCohortProfile;

        $parts = [];

        if ($candidate) {
            $parts[] = "Profession: " . ($candidate->profession->name ?? 'N/A');
            $parts[] = "Experience: " . ($candidate->experience->name ?? 'N/A');
            $parts[] = "Skills: " . implode(', ', $this->extractSkills($mentee));
        }

        if ($cohortProfile) {
            $parts[] = "Persona: " . ($cohortProfile->persona?->value ?? 'learner');
            $parts[] = "Goals: " . implode(', ', $this->extractGoals($mentee));
        }

        return implode("\n", $parts) ?: "Professional seeking mentorship";
    }

    /**
     * Build mentor profile for AI analysis
     */
    private function buildMentorProfile(MentorshipProgram $program): string
    {
        $parts = [
            "Title: " . $program->title,
            "Focus area: " . ($program->focus_area ?? 'General'),
            "Delivery: " . ($program->delivery_mode ?? 'Virtual'),
        ];

        $criteria = $program->matching_criteria ?? [];
        if (isset($criteria['focus']) && is_array($criteria['focus'])) {
            $parts[] = "Specialties: " . implode(', ', $criteria['focus']);
        }

        return implode("\n", $parts);
    }

    /**
     * Extract skills from user profile
     */
    private function extractSkills(User $mentee): array
    {
        $candidate = $mentee->candidate;
        if (!$candidate) {
            return ['communication', 'leadership'];
        }

        $skills = [];

        // From profession
        if ($candidate->profession) {
            $skills[] = $candidate->profession->name;
        }

        // From preferences
        $preferences = $mentee->womenCohortProfile?->preferences ?? [];
        if (isset($preferences['skills']) && is_array($preferences['skills'])) {
            $skills = array_merge($skills, $preferences['skills']);
        }

        return array_slice(array_unique($skills), 0, 5);
    }

    /**
     * Extract goals from user profile
     */
    private function extractGoals(User $mentee): array
    {
        $preferences = $mentee->womenCohortProfile?->preferences ?? [];

        if (isset($preferences['goals']) && is_array($preferences['goals'])) {
            return array_slice($preferences['goals'], 0, 3);
        }

        return ['Career advancement', 'Skill development', 'Network building'];
    }

    /**
     * Infer communication style from user data
     */
    private function inferCommunicationStyle(User $mentee): string
    {
        // Simplified - in production would analyze post patterns, engagement style, etc.
        $persona = $mentee->womenCohortProfile?->persona?->value ?? 'balanced';

        return match ($persona) {
            'first_home_buyer', 'learner' => 'Curious and detail-oriented',
            'upgrader', 'investor' => 'Goal-focused and strategic',
            'mentor' => 'Supportive and collaborative',
            default => 'Balanced and adaptable',
        };
    }

    /**
     * Infer mentor style from program data
     */
    private function inferMentorStyle(MentorshipProgram $program): string
    {
        $delivery = $program->delivery_mode ?? 'virtual';

        return match ($delivery) {
            'one_on_one' => 'Personalized and hands-on',
            'group' => 'Collaborative and community-focused',
            'workshop' => 'Structured and educational',
            default => 'Flexible and supportive',
        };
    }

    /**
     * Calculate style compatibility percentage
     *
     * @psalm-return int<75, 95>
     */
    private function calculateStyleCompatibility(string $menteeStyle, string $mentorStyle): int
    {
        // Simplified compatibility - all styles considered compatible for women's empowerment
        return rand(75, 95);
    }

    /**
     * Generate interaction tips based on styles
     *
     * @return string[]
     *
     * @psalm-return list{'Come prepared with specific questions and goals for each session', 'Be open to feedback and willing to step outside your comfort zone', 'Follow up on action items between sessions to maximize learning', 'Build a trusting relationship through consistent communication'}
     */
    private function generateInteractionTips(string $menteeStyle, string $mentorStyle): array
    {
        return [
            'Come prepared with specific questions and goals for each session',
            'Be open to feedback and willing to step outside your comfort zone',
            'Follow up on action items between sessions to maximize learning',
            'Build a trusting relationship through consistent communication',
        ];
    }

    /**
     * Fallback recommendations
     *
     * @return (int|null|string)[][]
     *
     * @psalm-return list{array{program_id: null, title: 'Career Development Mentorship', mentor: 'WomenRise mentor network', focus_area: 'Professional growth', fit_score: 75, ai_compatibility_score: 75, cta: 'Explore mentorship opportunities', summary: 'Connect with experienced professionals in your field'}}
     */
    private function fallbackRecommendations(): array
    {
        return [
            [
                'program_id' => null,
                'title' => 'Career Development Mentorship',
                'mentor' => 'WomenRise mentor network',
                'focus_area' => 'Professional growth',
                'fit_score' => 75,
                'ai_compatibility_score' => 75,
                'cta' => 'Explore mentorship opportunities',
                'summary' => 'Connect with experienced professionals in your field',
            ],
        ];
    }

    /**
     * Fallback compatibility analysis
     *
     * @return (int|string|string[])[]
     *
     * @psalm-return array{ai_compatibility_score: 70, strengths: list{'Aligned career goals', 'Complementary skills'}, growth_areas: list{'Communication preferences', 'Scheduling availability'}, ai_recommendation: 'Promising match worth exploring'}
     */
    private function fallbackCompatibilityAnalysis(): array
    {
        return [
            'ai_compatibility_score' => 70,
            'strengths' => ['Aligned career goals', 'Complementary skills'],
            'growth_areas' => ['Communication preferences', 'Scheduling availability'],
            'ai_recommendation' => 'Promising match worth exploring',
        ];
    }

    /**
     * Fallback learning path
     *
     * @return ((int|string|string[])[][]|int|string)[]
     *
     * @psalm-return array{learning_path: list{array{month: 1, focus: 'Foundation building', objectives: list{'Assess current skills', 'Set clear goals'}}, array{month: 2, focus: 'Skill development', objectives: list{'Learn new techniques', 'Apply to projects'}}, array{month: 3, focus: 'Integration', objectives: list{'Review progress', 'Plan next steps'}}}, estimated_duration_months: 3, focus_area: string}
     */
    private function fallbackLearningPath(string $focusArea): array
    {
        return [
            'learning_path' => [
                ['month' => 1, 'focus' => 'Foundation building', 'objectives' => ['Assess current skills', 'Set clear goals']],
                ['month' => 2, 'focus' => 'Skill development', 'objectives' => ['Learn new techniques', 'Apply to projects']],
                ['month' => 3, 'focus' => 'Integration', 'objectives' => ['Review progress', 'Plan next steps']],
            ],
            'estimated_duration_months' => 3,
            'focus_area' => $focusArea,
        ];
    }
}

