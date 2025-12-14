<?php

namespace App\Http\Controllers\PublicSector;

use App\Http\Controllers\Controller;
use App\Models\MissionBrief;
use App\Services\AiContextHistoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

final class MissionBriefAiController extends Controller
{
    public function __construct(private readonly AiContextHistoryService $historyService)
    {
        $this->middleware(['auth', 'verified']);
    }

    public function __invoke(Request $request, MissionBrief $missionBrief): JsonResponse
    {
        $missionBrief->loadMissing('opportunity.agency');

        $opportunity = $missionBrief->opportunity;

        abort_unless($opportunity, 404, 'Mission brief is not attached to an opportunity yet.');

        $contextToken = (string) Str::uuid();
        $generatedAt = now()->toIso8601String();
        $filters = $this->filtersForOpportunity($missionBrief);
        $selectionPreview = [[
            'opportunity' => $opportunity->title,
            'agency' => $opportunity->agency?->name,
            'stage' => $opportunity->pipeline_stage,
            'budget_band' => $opportunity->budget_band,
            'delivery_region' => $opportunity->delivery_region,
            'mission_objectives' => array_slice($missionBrief->mission_objectives ?? [], 0, 3),
            'impact_metrics' => array_slice($missionBrief->impact_metrics ?? [], 0, 3),
        ]];

        $contextPayload = base64_encode(json_encode([
            'token' => $contextToken,
            'generated_at' => $generatedAt,
            'selection_total' => 1,
            'filters' => $filters,
            'selection' => $selectionPreview,
        ], JSON_THROW_ON_ERROR));

        $prompt = $this->buildPrompt($missionBrief);

        $this->historyService->store($request->user()->id, 'public-sector.mission-brief', [
            'token' => $contextToken,
            'filters' => $filters,
            'selection_preview' => $selectionPreview,
            'selection_total' => 1,
            'prompt' => $prompt,
            'context_payload' => $contextPayload,
            'surface' => $missionBrief->ai_context_surface ?? 'public-sector-mission',
        ]);

        return response()->json([
            'context_payload' => $contextPayload,
            'prompt' => $prompt,
            'context_token' => $contextToken,
            'surface' => $missionBrief->ai_context_surface ?? 'public-sector-mission',
        ]);
    }

    /**
     * @return (mixed|null|string)[]
     *
     * @psalm-return array{stage: null|string, category: null|string, region: null|string, diversity: mixed|null}
     */
    private function filtersForOpportunity(MissionBrief $brief): array
    {
        $opportunity = $brief->opportunity;

        return Arr::where([
            'stage' => $opportunity?->pipeline_stage,
            'category' => $opportunity?->category,
            'region' => $opportunity?->delivery_region,
            'diversity' => $opportunity?->supplier_diversity_targets['headline'] ?? null,
        ], function ($value) {
            if (is_array($value)) {
                return !empty($value);
            }

            return filled($value);
        });
    }

    private function buildPrompt(MissionBrief $brief): string
    {
        $opportunity = $brief->opportunity;
        $objectives = implode('; ', array_slice($brief->mission_objectives ?? [], 0, 3));
        $impact = implode('; ', array_slice($brief->impact_metrics ?? [], 0, 3));
        $policies = implode('; ', array_slice($brief->policy_links ?? [], 0, 3));

        return <<<PROMPT
You are Athena's civic procurement co-pilot. Provide:
1. A one-paragraph mission interpretation for women founders.
2. Top compliance checkpoints to unblock award readiness.
3. Diversity levers that align with the supplier targets.

Mission: {$opportunity?->title}
Agency: {$opportunity?->agency?->name}
Stage: {$opportunity?->pipeline_stage}
Budget band: {$opportunity?->budget_band}
Objectives: {$objectives}
Impact metrics: {$impact}
Policy anchors: {$policies}
PROMPT;
    }
}

