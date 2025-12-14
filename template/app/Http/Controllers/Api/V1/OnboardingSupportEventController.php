<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\OnboardingEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

final class OnboardingSupportEventController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $this->validateRequest($request);

        $supportType = $validated['support'];
    $persona = $validated['persona'] ?? null;
    $interaction = $validated['interaction'] ?? null;
    $highlightedOnly = $validated['highlighted'] ?? false;
        $limit = $validated['limit'];
        $page = $validated['page'];

        $now = Carbon::now();
        $from = $this->resolveFrom($request, $now);

        $supportsCatalog = config('womenrise.supports', []);
        $supportLabel = $supportsCatalog[$supportType]['label'] ?? ucfirst(str_replace('-', ' ', $supportType));

        $query = OnboardingEvent::query()
            ->where('action', 'support_engagement')
            ->whereBetween('occurred_at', [$from, $now])
            ->where('payload->support_type', $supportType)
            ->orderByDesc('occurred_at');

        $countsQuery = clone $query;

        if ($persona) {
            $query->whereJsonContains('payload->persona_flags', $persona);
            $countsQuery->whereJsonContains('payload->persona_flags', $persona);
        }

        $ctaCount = (clone $countsQuery)
            ->where('payload->action', 'cta_clicked')
            ->count();

        $nudgeCount = (clone $countsQuery)
            ->where('payload->action', 'nudge_dismissed')
            ->count();

        $highlightedCount = (clone $countsQuery)
            ->where('payload->action', 'cta_clicked')
            ->where(function ($query) {
                $query->where('payload->highlighted', true)
                    ->orWhere('payload->highlighted', 1)
                    ->orWhere('payload->highlighted', '1');
            })
            ->count();

        if ($interaction) {
            $query->where('payload->action', $interaction);
        }

        if ($highlightedOnly) {
            $query->where(function ($innerQuery) {
                $innerQuery->where('payload->highlighted', true)
                    ->orWhere('payload->highlighted', 1)
                    ->orWhere('payload->highlighted', '1');
            });
        }

        $totalEvents = (clone $query)->count();

        $paginator = $query->simplePaginate(
            $limit,
            ['id', 'user_id', 'payload', 'occurred_at'],
            'page',
            $page
        );

        $events = collect($paginator->items())
            ->map(function (OnboardingEvent $event) {
                $payload = $event->payload ?? [];

                return [
                    'id' => $event->id,
                    'user_id' => $event->user_id,
                    'interaction' => $payload['action'] ?? null,
                    'support_type' => $payload['support_type'] ?? null,
                    'highlighted' => (bool) ($payload['highlighted'] ?? false),
                    'persona_flags' => array_values($payload['persona_flags'] ?? []),
                    'cta_label' => $payload['cta_label'] ?? null,
                    'nudge_text' => $payload['metadata']['nudge_text'] ?? null,
                    'occurred_at' => optional($event->occurred_at)->toIso8601String(),
                ];
            })
            ->filter(function (array $event) {
                return $event['interaction'] !== null;
            })
            ->values()
            ->all();

        return response()->json([
            'range' => [
                'from' => $from->toIso8601String(),
                'to' => $now->toIso8601String(),
            ],
            'support' => [
                'type' => $supportType,
                'label' => $supportLabel,
            ],
            'filters' => [
                'persona' => $persona,
                'interaction' => $interaction,
                'highlighted' => $highlightedOnly,
            ],
            'meta' => [
                'total_events' => $totalEvents,
                'counts' => [
                    'cta_clicks' => $ctaCount,
                    'nudge_dismissed' => $nudgeCount,
                    'highlighted_cta' => $highlightedCount,
                ],
            ],
            'pagination' => [
                'current_page' => (int) $paginator->currentPage(),
                'per_page' => (int) $paginator->perPage(),
                'has_more' => $paginator->hasMorePages(),
            ],
            'events' => $events,
        ]);
    }

    /**
     * @return (bool|int|mixed)[]
     *
     * @psalm-return array{limit: 25|mixed, page: 1|mixed, highlighted: bool,...}
     */
    private function validateRequest(Request $request): array
    {
        $validator = validator($request->all(), [
            'support' => ['required', 'string'],
            'persona' => ['nullable', 'string', 'max:191'],
            'interaction' => ['nullable', 'string'],
            'highlighted' => ['nullable', 'boolean'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        $data = $validator->validated();

        $supportsCatalog = config('womenrise.supports', []);
        $supportKey = $data['support'];

        if (! array_key_exists($supportKey, $supportsCatalog)) {
            throw ValidationException::withMessages([
                'support' => __('Selected support is not recognised.'),
            ]);
        }

        if (isset($data['interaction']) && ! in_array($data['interaction'], ['cta_clicked', 'nudge_dismissed'], true)) {
            throw ValidationException::withMessages([
                'interaction' => __('Selected interaction type is not supported.'),
            ]);
        }

        $data['limit'] = $data['limit'] ?? 25;
        $data['page'] = $data['page'] ?? 1;
        $data['highlighted'] = (bool) ($data['highlighted'] ?? false);

        return $data;
    }

    private function resolveFrom(Request $request, Carbon $fallbackTo): Carbon
    {
        $candidate = $request->query('from');
        $defaultFrom = $fallbackTo->copy()->subDays(14);

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
}

