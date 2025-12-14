<?php

namespace App\Http\Controllers\Business;

use App\Http\Controllers\Controller;
use App\Models\Business\BusinessProfile;
use App\Models\Business\BusinessResource;
use App\Services\Business\BusinessAiAdvisor;
use App\Services\Business\BusinessDigestService;
use App\Services\Business\BusinessFeedService;
use App\Services\Business\BusinessInsightsService;
use App\Services\AiContextHistoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class DashboardController extends Controller
{
    public function __invoke(
        Request $request,
        BusinessAiAdvisor $aiAdvisor,
        BusinessFeedService $feedService,
        BusinessInsightsService $insightsService,
        BusinessDigestService $digestService
    ): View
    {
        $user = $request->user();

        $profile = BusinessProfile::firstOrCreate(
            ['user_id' => $user->id],
            [
                'venture_name' => $user->name.' Studio',
                'tagline' => 'Women-owned. Community-backed.',
                'focus_industry' => 'Women-first ventures',
                'stage' => 'idea',
                'team_size' => '1-3',
                'focus_pillars' => ['capital readiness', 'distribution', 'brand heat'],
                'support_needs' => ['grant strategy', 'pilot customers', 'mentor circle'],
                'metrics' => ['waitlist' => 0, 'pilot_partners' => 0],
                'hero_theme' => 'blush',
                'slug' => BusinessProfile::generateUniqueSlug($user->name ?? 'business-hub'),
            ]
        );

        BusinessResource::ensureStarterSet();

        $profile->load(['milestones']);
        $digestSnapshot = $insightsService->snapshot($profile);
        $digestService->notifyIfDue($user, $profile, $digestSnapshot);

        $aiPlaybook = $aiAdvisor->generatePlaybook($profile, $profile->milestones);
        $feedPosts = $feedService->posts($user->socialProfile, 6);
        $recommendedProfiles = $feedService->recommendedProfiles($user->socialProfile, 5);
        $trendingTags = $feedService->trendingTags();
        $resources = BusinessResource::published()
            ->orderByDesc('ai_relevance_score')
            ->limit(4)
            ->get();
        $businessContext = $this->buildBusinessConciergePayload($profile);

        return view('business.dashboard', [
            'profile' => $profile,
            'aiPlaybook' => $aiPlaybook,
            'posts' => $feedPosts,
            'recommendedProfiles' => $recommendedProfiles,
            'trendingTags' => $trendingTags,
            'resources' => $resources,
            'digestSnapshot' => $digestSnapshot,
            'aiConciergePayloads' => $businessContext
                ? ['business-legal-foundations' => $businessContext]
                : [],
            'aiConciergeSurface' => 'business_workspace',
        ]);
    }

    /**
     * @return ((((mixed|string)[]|int|mixed|string)[]|mixed|string)[]|false|int|string)[]|null
     *
     * @psalm-return array{context_payload: string, prompt: string, token: string, filters: array{surface: 'business_workspace', venture?: string, stage?: string, team_size?: string, industry?: string, support_needs?: string, focus_pillars?: string, metrics?: string, formation_structure?: mixed}, selection_preview: array<int, array{id: int|mixed, description: mixed|string, status: mixed|string, category: string, account: mixed|string, posted_at: mixed|string, ai_suggestions: array{0?: mixed|string, 1?: mixed|string}}>, selection_total: int, surface: 'business_workspace', resumed_from_history: false}|null
     */
    private function buildBusinessConciergePayload(BusinessProfile $profile): array|null
    {
        $milestones = $profile->milestones ?? collect();

        if ($milestones->isEmpty()) {
            return null;
        }

        $selection = $milestones
            ->take(4)
            ->map(/**
             * @return (int|string|string[])[]
             *
             * @psalm-return array{id: int, description: string, status: string, category: string, account: string, posted_at: string, ai_suggestions: array{0?: string, 1?: string}}
             */
            function ($milestone): array {
                $due = optional($milestone->due_date)->format('d M');

                return [
                    'id' => $milestone->id,
                    'description' => $milestone->title,
                    'status' => $milestone->statusLabel(),
                    'category' => ucfirst($milestone->category ?? 'Growth'),
                    'account' => $milestone->cta_label ?? 'Business milestone',
                    'posted_at' => $due,
                    'ai_suggestions' => array_filter([$milestone->ai_prompt, $milestone->summary]),
                ];
            })
            ->values()
            ->all();

        $filters = array_filter([
            'surface' => 'business_workspace',
            'venture' => $profile->venture_name ?? $profile->user->name ?? 'Business Network venture',
            'stage' => ucfirst($profile->stage ?? 'idea'),
            'team_size' => $profile->team_size,
            'industry' => $profile->focus_industry,
            'support_needs' => $this->stringifyList($profile->support_needs),
            'focus_pillars' => $this->stringifyList($profile->focus_pillars),
            'metrics' => $this->summariseMetrics($profile->metrics ?? []),
            'formation_structure' => data_get($profile->formation_questionnaire, 'structure'),
        ]);

        $payload = [
            'token' => (string) Str::uuid(),
            'surface' => 'business_workspace',
            'generated_at' => now()->toIso8601String(),
            'selection_total' => $milestones->count(),
            'filters' => $filters,
            'selection' => $selection,
        ];

        $prompt = sprintf(
            'Could you walk me through next legal + compliance moves for a %s stage %s venture? Interested in grants and structure guardrails.',
            ucfirst($profile->stage ?? 'idea'),
            $profile->focus_industry ?? 'women-first'
        );

        $encoded = base64_encode(json_encode($payload, JSON_THROW_ON_ERROR));

        $result = [
            'context_payload' => $encoded,
            'prompt' => $prompt,
            'token' => $payload['token'],
            'filters' => $filters,
            'selection_preview' => $selection,
            'selection_total' => $payload['selection_total'],
            'surface' => 'business_workspace',
            'resumed_from_history' => false,
        ];

        $this->persistAiHistory('business-legal-foundations', $result);

        return $result;
    }

    private function stringifyList(array|null $value): string|null
    {
        if (empty($value)) {
            return null;
        }

        $items = collect($value)
            ->map(fn ($entry) => is_string($entry) ? trim($entry) : (string) $entry)
            ->filter()
            ->values()
            ->all();

        return empty($items) ? null : implode(', ', $items);
    }

    private function summariseMetrics(array $metrics): string|null
    {
        if (empty($metrics)) {
            return null;
        }

        $parts = [];

        foreach ($metrics as $key => $value) {
            if (!is_numeric($value)) {
                continue;
            }

            $label = str_replace('_', ' ', (string) $key);
            $parts[] = sprintf('%s: %s', ucfirst($label), number_format((float) $value));
        }

        return empty($parts) ? null : implode(' • ', $parts);
    }

    private function persistAiHistory(string $contextKey, array $snapshot): void
    {
        $userId = Auth::id();

        if (!$userId || empty($snapshot['context_payload'] ?? null)) {
            return;
        }

        app(AiContextHistoryService::class)->store($userId, $contextKey, [
            'token' => $snapshot['token'] ?? (string) Str::uuid(),
            'filters' => $snapshot['filters'] ?? [],
            'selection_preview' => $snapshot['selection_preview'] ?? [],
            'selection_total' => $snapshot['selection_total'] ?? 0,
            'prompt' => $snapshot['prompt'] ?? null,
            'context_payload' => $snapshot['context_payload'],
            'surface' => $snapshot['surface'] ?? 'business_workspace',
        ]);
    }
}

