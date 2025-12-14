<?php

namespace App\Services\Pathways;

use App\Models\Pathways\LifePathway;
use App\Models\Pathways\PathwayPhase;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

final class PathwayBuilderService
{
    public function createPathway(User $user, array $data): LifePathway
    {
        return DB::transaction(function () use ($user, $data) {
            $pathway = LifePathway::create([
                'user_id' => $user->id,
                'title' => $data['title'],
                'goal_key' => $data['goal_key'],
                'status' => $data['status'] ?? 'draft',
                'summary' => $data['summary'] ?? null,
                'confidence_score' => $data['confidence_score'] ?? 0,
                'impact_score' => $data['impact_score'] ?? 0,
                'urgency_label' => $data['urgency_label'] ?? 'steady',
                'focus_areas' => $data['focus_areas'] ?? [],
                'ai_context' => $data['ai_context'] ?? [],
                'metrics' => $data['metrics'] ?? [],
            ]);

            if (! empty($data['phases'])) {
                $this->addPhases($pathway, $data['phases']);
            }

            $pathway->recalculateTotals();

            return $pathway->fresh(['phases.milestones']);
        });
    }

    public function addPhases(LifePathway $pathway, array $phasesData): void
    {
        foreach ($phasesData as $phaseData) {
            $phase = $pathway->phases()->create([
                'sequence' => $phaseData['sequence'],
                'title' => $phaseData['title'],
                'description' => $phaseData['description'] ?? null,
                'estimated_duration_weeks' => $phaseData['estimated_duration_weeks'] ?? 0,
                'estimated_cost_aud' => $phaseData['estimated_cost_aud'] ?? 0,
                'readiness_state' => $phaseData['readiness_state'] ?? 'planned',
                'mentor_type' => $phaseData['mentor_type'] ?? null,
                'support_level' => $phaseData['support_level'] ?? null,
                'impact_weight' => $phaseData['impact_weight'] ?? 0,
                'dependencies' => $phaseData['dependencies'] ?? [],
                'metadata' => $phaseData['metadata'] ?? [],
            ]);

            if (! empty($phaseData['milestones'])) {
                $this->addMilestones($phase, $phaseData['milestones']);
            }
        }
    }

    public function addMilestones(PathwayPhase $phase, array $milestonesData): void
    {
        foreach ($milestonesData as $milestoneData) {
            $phase->milestones()->create([
                'sequence' => $milestoneData['sequence'],
                'title' => $milestoneData['title'],
                'description' => $milestoneData['description'] ?? null,
                'due_on' => $milestoneData['due_on'] ?? null,
                'status' => $milestoneData['status'] ?? 'planned',
                'progress' => $milestoneData['progress'] ?? 0,
                'blockers' => $milestoneData['blockers'] ?? null,
                'metadata' => $milestoneData['metadata'] ?? [],
            ]);
        }
    }

    public function updateProgress(LifePathway $pathway): void
    {
        // Logic to update progress based on milestones completion
        // This could involve recalculating the overall progress of the pathway
        // and updating the status if all milestones are complete.

        $pathway->recalculateTotals();
        // Additional logic can be added here
    }
}

