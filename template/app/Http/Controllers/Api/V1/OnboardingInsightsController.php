<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\OnboardingEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

final class OnboardingInsightsController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $now = Carbon::now();
        $from = $this->resolveFrom($request, $now);
        $personaFilter = $this->resolvePersona($request);
        $configSupports = config('womenrise.supports', []);
        $supportOrder = array_keys($configSupports);

        $cacheKey = sprintf(
            'onboarding:support-insights:%s:%s:%s:%s',
            $from->timestamp,
            $now->timestamp,
            $personaFilter ?? 'all',
            md5(json_encode($supportOrder))
        );

        $payload = Cache::remember($cacheKey, now()->addMinutes(5), function () use ($from, $now, $personaFilter, $configSupports, $supportOrder) {
            $events = OnboardingEvent::query()
                ->where('action', 'support_engagement')
                ->whereBetween('occurred_at', [$from, $now])
                ->orderByDesc('occurred_at')
                ->get(['id', 'user_id', 'payload', 'occurred_at']);

            $normalized = $events->map(function (OnboardingEvent $event) {
                $payload = $event->payload ?? [];

                return [
                    'id' => $event->id,
                    'user_id' => $event->user_id,
                    'support_type' => $payload['support_type'] ?? null,
                    'interaction' => $payload['action'] ?? null,
                    'highlighted' => (bool) ($payload['highlighted'] ?? false),
                    'persona_flags' => array_values($payload['persona_flags'] ?? []),
                    'nudge_text' => $payload['metadata']['nudge_text'] ?? null,
                    'cta_label' => $payload['cta_label'] ?? null,
                    'occurred_at' => $event->occurred_at,
                ];
            })->filter(function (array $event) {
                return $event['support_type'] !== null && $event['interaction'] !== null;
            });

            if ($personaFilter) {
                $normalized = $normalized->filter(function (array $event) use ($personaFilter) {
                    return in_array($personaFilter, $event['persona_flags'], true);
                })->values();
            }

            $summary = $this->buildSummary($normalized);

            $supports = collect($supportOrder)
                ->filter()
                ->map(function (string $type) use ($normalized, $configSupports) {
                    $events = $normalized->where('support_type', $type);
                    return $this->buildSupportInsight($type, $configSupports[$type] ?? [], $events);
                })
                ->filter(function (array $insight) {
                    return $insight['metrics']['total_events'] > 0;
                })
                ->values()
                ->all();

            return [
                'range' => [
                    'from' => $from->toIso8601String(),
                    'to' => $now->toIso8601String(),
                ],
                'filters' => [
                    'persona' => $personaFilter,
                ],
                'summary' => $summary,
                'supports' => $supports,
                'timeline' => $this->buildTimeline($normalized, $from, $now),
            ];
        });

        return response()->json($payload);
    }

    /**
     * @return (((int|string)|float|null)[][]|int)[][]
     *
     * @psalm-return array{totals: array{events: int, cta_clicks: int, nudge_dismissed: int, unique_users: int}, distribution: array{supports: array<int, array{support_type: string, total: int, percentage: float|null}>, personas: array<int, array{persona: array-key, total: int, percentage: float|null}>}}
     */
    private function buildSummary(Collection $events): array
    {
        $totalEvents = $events->count();
        $ctaEvents = $events->where('interaction', 'cta_clicked');
        $nudgeDismissals = $events->where('interaction', 'nudge_dismissed');

        $uniqueUsers = $events->pluck('user_id')->filter()->unique()->count();

        $supportDistribution = $events
            ->groupBy('support_type')
            ->map(function (Collection $group, string $type) use ($totalEvents) {
                $count = $group->count();

                return [
                    'support_type' => $type,
                    'total' => $count,
                    'percentage' => $totalEvents > 0 ? round(($count / $totalEvents) * 100, 1) : null,
                ];
            })
            ->sortByDesc('total')
            ->values()
            ->all();

        $personaDistribution = $events
            ->flatMap(function (array $event) {
                return $event['persona_flags'] ?? [];
            })
            ->filter()
            ->countBy()
            ->sortDesc()
            ->map(function ($count, $persona) use ($totalEvents) {
                return [
                    'persona' => $persona,
                    'total' => $count,
                    'percentage' => $totalEvents > 0 ? round(($count / $totalEvents) * 100, 1) : null,
                ];
            })
            ->values()
            ->all();

        return [
            'totals' => [
                'events' => $totalEvents,
                'cta_clicks' => $ctaEvents->count(),
                'nudge_dismissed' => $nudgeDismissals->count(),
                'unique_users' => $uniqueUsers,
            ],
            'distribution' => [
                'supports' => $supportDistribution,
                'personas' => $personaDistribution,
            ],
        ];
    }

    /**
     * @return ((((int|string)|float|null)[][]|float|int|null)[]|mixed|string)[]
     *
     * @psalm-return array{support_type: string, label: mixed|string, metrics: array{total_events: int, cta_total: int<min, max>, cta_unique_users: int, cta_highlight_rate: float|null, nudge_dismissed_total: int}, insights: array{top_cta_labels: array<int, array{label: array-key, total: int}>, top_dismissed_nudges: array<int, array{text: array-key, total: int}>, persona_breakdown: array<int, array{persona: array-key, total: int, percentage: float|null}>}}
     */
    private function buildSupportInsight(string $type, array $catalogEntry, Collection $events): array
    {
        $label = $catalogEntry['label'] ?? ucfirst(str_replace('-', ' ', $type));
        $ctaEvents = $events->where('interaction', 'cta_clicked');
        $nudgeDismissals = $events->where('interaction', 'nudge_dismissed');

        $highlightedTotal = $ctaEvents->where('highlighted', true)->count();
        $ctaTotal = $ctaEvents->count();
        $highlightRate = $ctaTotal > 0
            ? round(($highlightedTotal / $ctaTotal) * 100, 1)
            : null;

        $uniqueCtaUsers = $ctaEvents->pluck('user_id')->filter()->unique()->count();

        $topCtaLabels = $ctaEvents
            ->pluck('cta_label')
            ->filter()
            ->countBy()
            ->sortDesc()
            ->take(3)
            ->map(function ($count, $label) {
                return [
                    'label' => $label,
                    'total' => $count,
                ];
            })
            ->values()
            ->all();

        $topNudges = $nudgeDismissals
            ->pluck('nudge_text')
            ->filter()
            ->countBy()
            ->sortDesc()
            ->take(3)
            ->map(function ($count, $text) {
                return [
                    'text' => $text,
                    'total' => $count,
                ];
            })
            ->values()
            ->all();

        $personaBreakdown = $events
            ->flatMap(function (array $event) {
                return $event['persona_flags'] ?? [];
            })
            ->filter()
            ->countBy()
            ->sortDesc()
            ->take(5)
            ->map(function ($count, $persona) use ($events) {
                return [
                    'persona' => $persona,
                    'total' => $count,
                    'percentage' => $events->count() > 0 ? round(($count / $events->count()) * 100, 1) : null,
                ];
            })
            ->values()
            ->all();

        return [
            'support_type' => $type,
            'label' => $label,
            'metrics' => [
                'total_events' => $events->count(),
                'cta_total' => $ctaTotal,
                'cta_unique_users' => $uniqueCtaUsers,
                'cta_highlight_rate' => $highlightRate,
                'nudge_dismissed_total' => $nudgeDismissals->count(),
            ],
            'insights' => [
                'top_cta_labels' => $topCtaLabels,
                'top_dismissed_nudges' => $topNudges,
                'persona_breakdown' => $personaBreakdown,
            ],
        ];
    }

    private function resolveFrom(Request $request, Carbon $fallbackTo): Carbon
    {
        $defaultFrom = $fallbackTo->copy()->subDays(14);
        $candidate = $request->query('from');

        if (! $candidate) {
            return $defaultFrom;
        }

        try {
            $parsed = Carbon::parse($candidate);
        } catch (\Throwable $exception) {
            return $defaultFrom;
        }

        if ($parsed->greaterThan($fallbackTo)) {
            return $defaultFrom;
        }

        return $parsed;
    }

    private function resolvePersona(Request $request): ?string
    {
        $persona = $request->query('persona');

        if (! $persona) {
            return null;
        }

        $persona = trim((string) $persona);

        return $persona === '' ? null : substr($persona, 0, 191);
    }

    /**
     * @return (int|string)[][]
     *
     * @psalm-return list{0?: array{date: string, total_events: int, cta_clicks: int, nudge_dismissed: int},...}
     */
    private function buildTimeline(Collection $events, Carbon $from, Carbon $to): array
    {
        if ($events->isEmpty()) {
            return [];
        }

        $grouped = $events
            ->filter(fn (array $event) => ! empty($event['occurred_at']))
            ->groupBy(function (array $event) {
                return Carbon::parse($event['occurred_at'])->toDateString();
            });

        $timeline = [];
        $cursor = $from->copy()->startOfDay();
        $end = $to->copy()->startOfDay();

        while ($cursor->lte($end)) {
            $dateKey = $cursor->toDateString();
            /** @var Collection $dayEvents */
            $dayEvents = $grouped->get($dateKey, collect());

            $timeline[] = [
                'date' => $dateKey,
                'total_events' => $dayEvents->count(),
                'cta_clicks' => $dayEvents->where('interaction', 'cta_clicked')->count(),
                'nudge_dismissed' => $dayEvents->where('interaction', 'nudge_dismissed')->count(),
            ];

            $cursor->addDay();
        }

        return $timeline;
    }
}

