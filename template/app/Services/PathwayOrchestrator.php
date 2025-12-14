<?php

namespace App\Services;

use App\Models\User;
use App\Models\Pathways\LifePathway;
use App\Models\Pathways\PathwayPhase;
use App\Models\Pathways\PathwayMilestone;
use App\Models\Pathways\PathwayTemplate;
use App\Models\Pathways\PathwayOutcome;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use App\Contracts\AI\TextModel;
use Illuminate\Support\Str;

final class PathwayOrchestrator
{

    private TextModel $textModel;

    public function __construct(TextModel $textModel)
    {
        $this->textModel = $textModel;
    }


    /**
     * Create a new pathway from template or custom goal
     */
    public function createPathway(
        User $user,
        string $goal,
        array $constraints = []
    ): LifePathway {
        // Check if template exists
        $template = PathwayTemplate::where('template_name', 'LIKE', "%{$goal}%")->first();

        if ($template) {
            return $this->createFromTemplate($user, $template, $constraints);
        }

        // Otherwise, AI-generate pathway (placeholder for now)
        // In a real implementation, this would call an AI service
        return $this->generateCustomPathway($user, $goal, $constraints);
    }

    /**
     * Create pathway from pre-built template
     */
    private function createFromTemplate(
        User $user,
        PathwayTemplate $template,
        array $constraints
    ): LifePathway {
        return DB::transaction(function () use ($user, $template, $constraints) {
            $pathway = LifePathway::create([
                'user_id' => $user->id,
                'pathway_type' => $template->pathway_type,
                'goal_title' => $template->template_name,
                'title' => $template->template_name, // Fill legacy field
                'goal_key' => \Illuminate\Support\Str::slug($template->template_name), // Fill legacy field
                'goal_description' => $template->description,
                'status' => 'planning',
                'total_phases' => count($template->phases_json['phases'] ?? []),
            ]);

            $phases = $template->phases_json['phases'] ?? [];
            foreach ($phases as $index => $phaseData) {
                $phase = PathwayPhase::create([
                    'life_pathway_id' => $pathway->id,
                    'sequence' => $index + 1,
                    'title' => $phaseData['title'],
                    'description' => $phaseData['description'] ?? null,
                    'estimated_duration_weeks' => $phaseData['duration_weeks'] ?? null,
                    'estimated_cost_aud' => $phaseData['cost'] ?? 0,
                    'readiness_state' => $index === 0 ? 'active' : 'locked',
                ]);

                // Create milestones if defined in template
                if (isset($phaseData['milestones'])) {
                    foreach ($phaseData['milestones'] as $mIndex => $milestoneData) {
                        PathwayMilestone::create([
                            'pathway_phase_id' => $phase->id,
                            'sequence' => $mIndex + 1,
                            'milestone_type' => $milestoneData['type'] ?? 'action',
                            'title' => $milestoneData['title'],
                            'description' => $milestoneData['description'] ?? null,
                            'status' => 'pending',
                        ]);
                    }
                }
            }

            return $pathway;
        });
    }

    private function generateCustomPathway(User $user, string $goal, array $constraints): LifePathway
    {
        $prompt = <<<PROMPT
You are an expert life coach and career planner.
Create a structured plan for the following goal: "{$goal}".
The plan should be broken down into sequential phases, and each phase should have specific actionable milestones.
Return ONLY valid JSON matching this structure:
{
    "phases": [
        {
            "title": "Phase Title",
            "description": "Brief description of this phase",
            "duration_weeks": 4,
            "cost": 0,
            "milestones": [
                {
                    "title": "Milestone Title",
                    "description": "Actionable step",
                    "type": "action"
                }
            ]
        }
    ]
}
PROMPT;

        try {
            $jsonResponse = $this->textModel->generate($prompt, ['max_tokens' => 2000]);
            // Clean up potential markdown code blocks
            $jsonResponse = str_replace(['```json', '```'], '', $jsonResponse);
            $data = json_decode($jsonResponse, true);
        } catch (\Throwable $e) {
            // Fallback if AI fails
            $data = [];
        }

        if (empty($data['phases'])) {
             // Fallback structure
             $data = [
                 'phases' => [
                     [
                         'title' => 'Getting Started',
                         'description' => 'Initial planning and research',
                         'duration_weeks' => 1,
                         'milestones' => [
                             ['title' => 'Define specific objectives', 'type' => 'action', 'description' => 'Write down exactly what you want to achieve.']
                         ]
                     ]
                 ]
             ];
        }

        return DB::transaction(function () use ($user, $goal, $data) {
            $pathway = LifePathway::create([
                'user_id' => $user->id,
                'pathway_type' => 'custom',
                'goal_title' => $goal,
                'title' => $goal,
                'goal_key' => Str::slug($goal),
                'goal_description' => "Custom pathway for: $goal",
                'status' => 'planning',
                'total_phases' => count($data['phases']),
            ]);

            foreach ($data['phases'] as $index => $phaseData) {
                $phase = PathwayPhase::create([
                    'life_pathway_id' => $pathway->id,
                    'sequence' => $index + 1,
                    'title' => $phaseData['title'],
                    'description' => $phaseData['description'] ?? null,
                    'estimated_duration_weeks' => $phaseData['duration_weeks'] ?? null,
                    'estimated_cost_aud' => $phaseData['cost'] ?? 0,
                    'readiness_state' => $index === 0 ? 'active' : 'locked',
                ]);

                if (isset($phaseData['milestones'])) {
                    foreach ($phaseData['milestones'] as $mIndex => $milestoneData) {
                        PathwayMilestone::create([
                            'pathway_phase_id' => $phase->id,
                            'sequence' => $mIndex + 1,
                            'milestone_type' => $milestoneData['type'] ?? 'action',
                            'title' => $milestoneData['title'],
                            'description' => $milestoneData['description'] ?? null,
                            'status' => 'pending',
                        ]);
                    }
                }
            }

            return $pathway;
        });
    }

    /**
     * Get user's pathways with progress
     */
    public function getUserPathways(User $user): Collection
    {
        return LifePathway::where('user_id', $user->id)
            ->whereIn('status', ['planning', 'active', 'paused'])
            ->with(['phases' => function ($query) {
                $query->orderBy('sequence');
            }, 'phases.milestones'])
            ->get()
            ->map(function ($pathway) {
                return [
                    'pathway' => $pathway,
                    'progress_percentage' => $this->calculateProgress($pathway),
                    'next_actions' => $this->getNextActions($pathway),
                ];
            });
    }

    /**
     * Calculate percentage complete
     */
    public function calculateProgress(LifePathway $pathway): float
    {
        $totalMilestones = PathwayMilestone::whereHas('phase', function ($query) use ($pathway) {
            $query->where('life_pathway_id', $pathway->id);
        })->count();

        if ($totalMilestones === 0) return 0;

        $completedMilestones = PathwayMilestone::whereHas('phase', function ($query) use ($pathway) {
            $query->where('life_pathway_id', $pathway->id);
        })->where('status', 'completed')->count();

        return round(($completedMilestones / $totalMilestones) * 100, 1);
    }

    /**
     * Get next 3-5 actions user should take
     */
    public function getNextActions(LifePathway $pathway): Collection
    {
        return PathwayMilestone::whereHas('phase', function ($query) use ($pathway) {
            $query->where('life_pathway_id', $pathway->id)
                  ->where('readiness_state', 'active');
        })
        ->whereIn('status', ['pending', 'in_progress'])
        ->orderBy('due_on', 'asc')
        ->limit(5)
        ->get();
    }

    private function completePhase(PathwayPhase $phase): void
    {
        $phase->update([
            'readiness_state' => 'completed',
            'completed_at' => now(),
        ]);

        // Unlock next phase
        $nextPhase = PathwayPhase::where('life_pathway_id', $phase->life_pathway_id)
            ->where('sequence', '>', $phase->sequence)
            ->orderBy('sequence')
            ->first();

        if ($nextPhase) {
            $nextPhase->update([
                'readiness_state' => 'active',
                'started_at' => now(),
            ]);
        } else {
            // No next phase = pathway complete
            $this->completePathway($phase->pathway);
        }
    }

    private function completePathway(LifePathway $pathway): void
    {
        $pathway->update([
            'status' => 'completed',
            'impact_score' => $this->calculateImpactScore($pathway),
        ]);
    }

    private function calculateImpactScore(LifePathway $pathway): float
    {
        // Placeholder logic
        return 100.0;
    }
}

