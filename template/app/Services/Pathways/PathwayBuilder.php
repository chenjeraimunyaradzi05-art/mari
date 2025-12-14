<?php

namespace App\Services\Pathways;

use App\Contracts\AI\TextModel;
use App\Models\Pathways\LifePathway;
use App\Models\Pathways\PathwayMilestone;
use App\Models\Pathways\PathwayPhase;
use App\Models\User;
use Illuminate\Cache\Repository as CacheRepository;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Throwable;

final class PathwayBuilder
{
    private const CACHE_TTL_DAYS = 30;
    private const MONTHLY_LIMIT = 10;

    public function __construct(
        private readonly TextModel $textModel,
        private readonly CacheRepository $cache
    ) {
    }

    public function build(User $user, string $goalKey, array $constraints = [], bool $force = false): LifePathway
    {
        $this->enforceMonthlyLimit($user);

        $payload = $this->resolvePlanPayload($user, $goalKey, $constraints, $force);

        return DB::transaction(function () use ($user, $goalKey, $payload) {
            $pathway = LifePathway::updateOrCreate(
                ['user_id' => $user->id, 'goal_key' => $goalKey],
                [
                    'title' => Arr::get($payload, 'title', Str::headline($goalKey)),
                    'summary' => Arr::get($payload, 'summary'),
                    'status' => Arr::get($payload, 'status', 'active'),
                    'confidence_score' => Arr::get($payload, 'confidence_score', 70),
                    'impact_score' => Arr::get($payload, 'impact_score', 65),
                    'total_duration_weeks' => Arr::get($payload, 'totals.duration_weeks'),
                    'total_cost_aud' => Arr::get($payload, 'totals.cost_aud'),
                    'urgency_label' => Arr::get($payload, 'urgency', 'steady'),
                    'focus_areas' => Arr::get($payload, 'focus_areas', []),
                    'ai_context' => [
                        'constraints' => $payload['constraints'] ?? [],
                        'source' => $payload['source'] ?? 'ai',
                    ],
                    'metrics' => Arr::get($payload, 'metrics', []),
                    'cached_at' => now(),
                ]
            );

            $pathway->phases()->delete();

            foreach (Arr::get($payload, 'phases', []) as $position => $phaseData) {
                /** @var PathwayPhase $phase */
                $phase = $pathway->phases()->create([
                    'sequence' => $position + 1,
                    'title' => Arr::get($phaseData, 'title', 'Phase '.($position + 1)),
                    'description' => Arr::get($phaseData, 'description'),
                    'estimated_duration_weeks' => Arr::get($phaseData, 'duration_weeks'),
                    'estimated_cost_aud' => Arr::get($phaseData, 'cost_aud'),
                    'readiness_state' => Arr::get($phaseData, 'state', 'planned'),
                    'mentor_type' => Arr::get($phaseData, 'mentor_type'),
                    'support_level' => Arr::get($phaseData, 'support_level'),
                    'impact_weight' => Arr::get($phaseData, 'impact_weight', 20),
                    'dependencies' => Arr::get($phaseData, 'dependencies', []),
                    'metadata' => [
                        'kpi' => Arr::get($phaseData, 'kpi'),
                    ],
                ]);

                foreach (Arr::get($phaseData, 'milestones', []) as $milestoneIndex => $milestoneData) {
                    $phase->milestones()->create([
                        'sequence' => $milestoneIndex + 1,
                        'title' => Arr::get($milestoneData, 'title', 'Milestone '.($milestoneIndex + 1)),
                        'description' => Arr::get($milestoneData, 'description'),
                        'due_on' => Arr::get($milestoneData, 'due_on'),
                        'status' => Arr::get($milestoneData, 'status', 'planned'),
                        'progress' => Arr::get($milestoneData, 'progress', 0),
                        'blockers' => Arr::get($milestoneData, 'blockers'),
                        'metadata' => Arr::get($milestoneData, 'metadata', []),
                    ]);
                }
            }

            $pathway->load('phases.milestones');
            $pathway->recalculateTotals();

            return $pathway;
        });
    }

    private function resolvePlanPayload(User $user, string $goalKey, array $constraints, bool $force): array
    {
        $cacheKey = sprintf('life-pathway:%d:%s', $user->id, $goalKey);
        if (! $force && $payload = $this->cache->get($cacheKey)) {
            return $payload;
        }

        $prompt = $this->buildPrompt($user, $goalKey, $constraints);

        try {
            $raw = $this->textModel->generate($prompt, ['max_tokens' => 900]);
            $decoded = json_decode($this->extractJson($raw), true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable $exception) {
            Log::warning('PathwayBuilder falling back to heuristic plan', [
                'goal' => $goalKey,
                'user_id' => $user->id,
                'error' => $exception->getMessage(),
            ]);
            $decoded = $this->fallbackPlan($goalKey);
        }

        $normalized = $this->normalizePlan($decoded, $goalKey, $constraints);
        $this->cache->put($cacheKey, $normalized, now()->addDays(self::CACHE_TTL_DAYS));

        return $normalized;
    }

    private function buildPrompt(User $user, string $goalKey, array $constraints): string
    {
        $summary = Str::limit(strip_tags((string) $user->bio), 280);
        $intent = data_get($user->user_intentions, 'intent.label');
        $displayName = $user->preferred_name ?? $user->name;
        $constraintCopy = collect($constraints)
            ->map(fn ($value, $key) => sprintf('%s: %s', Str::headline($key), $value))
            ->implode("\n");

        return trim(<<<PROMPT
You are Athena Life Pathways, an advisor who creates 4-5 phase journey plans for women.
Return JSON with keys: title, summary, status, confidence_score, impact_score, urgency, focus_areas (array), metrics, totals:{duration_weeks,cost_aud}, phases (array of phases). Each phase has: title, description, duration_weeks, cost_aud, state, mentor_type, support_level, impact_weight, kpi, dependencies (array), milestones (array). Each milestone has: title, description, due_on, status, progress, blockers.

Member Context:
    - Name: {$displayName}
- Intent: {$intent}
- Bio: {$summary}

Goal Key: {$goalKey}
Constraints:
{$constraintCopy}
PROMPT);
    }

    /**
     * @return ((((array|int|mixed|null|string)[][]|int|mixed|null|string)[]|mixed|null)[]|int|mixed|null|string)[]
     *
     * @psalm-return array{title: mixed|string, summary: mixed|null, status: 'active'|mixed, confidence_score: int, impact_score: int, urgency: 'steady'|mixed, focus_areas: array<never, never>|mixed, metrics: array<never, never>|mixed, phases: array<int, array{title: 'Phase'|mixed, description: mixed|null, duration_weeks: int, cost_aud: mixed|null, state: 'planned'|mixed, mentor_type: mixed|null, support_level: mixed|null, impact_weight: int, kpi: mixed|null, dependencies: array<never, never>|mixed, milestones: array<array{title: 'Milestone'|mixed, description: mixed|null, due_on: mixed|null, status: 'planned'|mixed, progress: int, blockers: mixed|null, metadata: array<never, never>|mixed}>}>, totals: array{duration_weeks: mixed|null, cost_aud: mixed|null}, constraints: array, source: 'ai'|mixed}
     */
    private function normalizePlan(array $plan, string $goalKey, array $constraints): array
    {
        $phases = collect($plan['phases'] ?? [])
            ->values()
            ->map(function ($phase) {
                $milestones = collect($phase['milestones'] ?? [])->map(fn ($milestone) => [
                    'title' => $milestone['title'] ?? 'Milestone',
                    'description' => $milestone['description'] ?? null,
                    'due_on' => $milestone['due_on'] ?? null,
                    'status' => $milestone['status'] ?? 'planned',
                    'progress' => (int) ($milestone['progress'] ?? 0),
                    'blockers' => $milestone['blockers'] ?? null,
                    'metadata' => $milestone['metadata'] ?? [],
                ])->all();

                return [
                    'title' => $phase['title'] ?? 'Phase',
                    'description' => $phase['description'] ?? null,
                    'duration_weeks' => (int) ($phase['duration_weeks'] ?? 0),
                    'cost_aud' => $phase['cost_aud'] ?? null,
                    'state' => $phase['state'] ?? 'planned',
                    'mentor_type' => $phase['mentor_type'] ?? null,
                    'support_level' => $phase['support_level'] ?? null,
                    'impact_weight' => (int) ($phase['impact_weight'] ?? 0),
                    'kpi' => $phase['kpi'] ?? null,
                    'dependencies' => $phase['dependencies'] ?? [],
                    'milestones' => $milestones,
                ];
            })
            ->all();

        $totals = [
            'duration_weeks' => collect($phases)->sum('duration_weeks') ?: null,
            'cost_aud' => collect($phases)->pluck('cost_aud')->filter()->sum() ?: null,
        ];

        return [
            'title' => $plan['title'] ?? Str::headline($goalKey),
            'summary' => $plan['summary'] ?? null,
            'status' => $plan['status'] ?? 'active',
            'confidence_score' => (int) ($plan['confidence_score'] ?? 70),
            'impact_score' => (int) ($plan['impact_score'] ?? 65),
            'urgency' => $plan['urgency'] ?? 'steady',
            'focus_areas' => $plan['focus_areas'] ?? [],
            'metrics' => $plan['metrics'] ?? [],
            'phases' => $phases,
            'totals' => $totals,
            'constraints' => $constraints,
            'source' => $plan['source'] ?? 'ai',
        ];
    }

    private function extractJson(string $raw): string
    {
        if (Str::startsWith(trim($raw), '{')) {
            return $raw;
        }

        if (preg_match('/\{.*\}/s', $raw, $matches)) {
            return $matches[0];
        }

        return $raw;
    }

    /**
     * @return ((((int|string)[][]|int|string)[]|string)[]|string)[]
     *
     * @psalm-return array{title: string, summary: 'Athena drafted a pragmatic pathway using existing signals.', urgency: 'accelerate', focus_areas: list{'income', 'support'}, phases: list{array{title: 'Stabilise essentials', description: 'Secure earnings, wraparound care, and breathing space.', duration_weeks: 6, cost_aud: 0, state: 'planned', support_level: 'high', impact_weight: 25, milestones: list{array{title: 'Complete emergency budget reset', status: 'planned', progress: 0}}}, array{title: 'Unlock growth moves', description: 'Layer study, licensing, or apprenticeships.', duration_weeks: 16, cost_aud: 2500, state: 'planned', support_level: 'medium', impact_weight: 35, milestones: list{array{title: 'Apply for flagship program', status: 'planned', progress: 0}}}, array{title: 'Launch outcomes & celebrate', description: 'Secure the role, property, or venture milestone.', duration_weeks: 10, cost_aud: 1500, state: 'planned', support_level: 'medium', impact_weight: 40, milestones: list{array{title: 'Sign offer / contract / lease', status: 'planned', progress: 0}}}}}
     */
    private function fallbackPlan(string $goalKey): array
    {
        return [
            'title' => Str::headline($goalKey).' Pathway',
            'summary' => 'Athena drafted a pragmatic pathway using existing signals.',
            'urgency' => 'accelerate',
            'focus_areas' => ['income', 'support'],
            'phases' => [
                [
                    'title' => 'Stabilise essentials',
                    'description' => 'Secure earnings, wraparound care, and breathing space.',
                    'duration_weeks' => 6,
                    'cost_aud' => 0,
                    'state' => 'planned',
                    'support_level' => 'high',
                    'impact_weight' => 25,
                    'milestones' => [[
                        'title' => 'Complete emergency budget reset',
                        'status' => 'planned',
                        'progress' => 0,
                    ]],
                ],
                [
                    'title' => 'Unlock growth moves',
                    'description' => 'Layer study, licensing, or apprenticeships.',
                    'duration_weeks' => 16,
                    'cost_aud' => 2500,
                    'state' => 'planned',
                    'support_level' => 'medium',
                    'impact_weight' => 35,
                    'milestones' => [[
                        'title' => 'Apply for flagship program',
                        'status' => 'planned',
                        'progress' => 0,
                    ]],
                ],
                [
                    'title' => 'Launch outcomes & celebrate',
                    'description' => 'Secure the role, property, or venture milestone.',
                    'duration_weeks' => 10,
                    'cost_aud' => 1500,
                    'state' => 'planned',
                    'support_level' => 'medium',
                    'impact_weight' => 40,
                    'milestones' => [[
                        'title' => 'Sign offer / contract / lease',
                        'status' => 'planned',
                        'progress' => 0,
                    ]],
                ],
            ],
        ];
    }

    private function enforceMonthlyLimit(User $user): void
    {
        $key = sprintf('life-pathway:limit:%d:%s', $user->id, now()->format('Y-m'));
        $attempts = (int) $this->cache->get($key, 0);

        if ($attempts >= self::MONTHLY_LIMIT) {
            throw new TooManyRequestsHttpException(0, 'Life Pathways refresh limit reached for this month.');
        }

        $this->cache->put($key, $attempts + 1, now()->addMonth()->startOfMonth());
    }
}

