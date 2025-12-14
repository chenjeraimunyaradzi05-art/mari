<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

final class AnalyticsEventSummaryController extends Controller
{
    public function __invoke(Request $request): Response|JsonResponse
    {
        $to = Carbon::now();
        $from = $this->resolveFrom($request, $to);
        $focusEvent = $this->resolveEvent($request);
        $rangeColumn = 'COALESCE(received_at, created_at)';
        $recentLimit = $this->resolveRecentLimit($request);
        $sourceFilter = $this->resolveStringQuery($request, 'source');
        $organizationFilter = $this->resolveStringQuery($request, 'organization');

        $key = sprintf(
            'analytics:summary:%s:%s:%s:%s:%s:%s',
            $from->timestamp,
            $to->timestamp,
            $focusEvent ?? 'all',
            $recentLimit,
            $sourceFilter ?? 'any',
            $organizationFilter ?? 'any'
        );

        $payload = Cache::remember($key, now()->addMinutes(5), function () use ($from, $to, $focusEvent, $rangeColumn, $recentLimit, $sourceFilter, $organizationFilter) {
            $maxClause = 'MAX(' . $rangeColumn . ') as last_seen';
            $dateClause = 'DATE(' . $rangeColumn . ') as date';

                $allEventsQuery = $this->applyFilters(
                    AnalyticsEvent::query()
                        ->select('event')
                        ->selectRaw('COUNT(*) as total')
                        ->selectRaw($maxClause)
                        ->groupBy('event')
                        ->orderByDesc('total'),
                    $rangeColumn,
                    $from,
                    $to,
                    null,
                    $sourceFilter,
                    $organizationFilter
                );

            $allEvents = $allEventsQuery
                ->get()
                ->map(function ($row) {
                    $lastSeen = $row->last_seen ? Carbon::parse($row->last_seen)->toIso8601String() : null;

                    return [
                        'event' => $row->event,
                        'total' => (int) $row->total,
                        'last_seen' => $lastSeen,
                    ];
                })
                ->all();

            $eventsCollection = collect($allEvents)->keyBy('event');

            $openedTotal = (int) ($eventsCollection->get('lead_form_opened')['total'] ?? 0);
            $submittedTotal = (int) ($eventsCollection->get('lead_form_submitted')['total'] ?? 0);

            $conversionRate = $openedTotal > 0
                ? round(($submittedTotal / $openedTotal) * 100, 2)
                : null;

            $timelineQuery = $this->applyFilters(
                AnalyticsEvent::query()
                    ->selectRaw($dateClause)
                    ->selectRaw('COUNT(*) as total')
                    ->groupBy('date')
                    ->orderBy('date'),
                $rangeColumn,
                $from,
                $to,
                $focusEvent,
                $sourceFilter,
                $organizationFilter
            );

            $timeline = $timelineQuery
                ->get()
                ->map(function ($row) {
                    return [
                        'date' => $row->date,
                        'total' => (int) $row->total,
                    ];
                })
                ->all();

            $totalEvents = array_reduce($timeline, function ($carry, $point) {
                return $carry + ($point['total'] ?? 0);
            }, 0);

            $averagePerDay = count($timeline) > 0
                ? round($totalEvents / count($timeline), 2)
                : 0;

            $recentEventsQuery = $this->applyFilters(
                AnalyticsEvent::query()
                    ->select(['id', 'event', 'properties', 'source', 'received_at', 'created_at'])
                    ->orderByRaw($rangeColumn . ' DESC')
                    ->limit($recentLimit),
                $rangeColumn,
                $from,
                $to,
                $focusEvent,
                $sourceFilter,
                $organizationFilter
            );

            $recentEvents = $recentEventsQuery
                ->get()
                ->map(function (AnalyticsEvent $event) {
                    $occurredAt = $event->received_at ?? $event->created_at;

                    return [
                        'event' => $event->event,
                        'occurred_at' => $occurredAt ? Carbon::parse($occurredAt)->toIso8601String() : null,
                        'source' => $event->source,
                        'properties' => $event->properties ?? [],
                    ];
                })
                ->all();

            $topSources = $this->applyFilters(
                AnalyticsEvent::query()
                    ->select('source')
                    ->selectRaw('COUNT(*) as total')
                    ->whereNotNull('source')
                    ->where('source', '!=', '')
                    ->groupBy('source')
                    ->orderByDesc('total')
                    ->limit(5),
                $rangeColumn,
                $from,
                $to,
                $focusEvent,
                $sourceFilter,
                $organizationFilter
            )
                ->get()
                ->map(function ($row) use ($totalEvents) {
                    $total = (int) ($row->total ?? 0);

                    return [
                        'source' => $row->source,
                        'total' => $total,
                        'percentage' => $totalEvents > 0 ? round(($total / $totalEvents) * 100, 1) : null,
                    ];
                })
                ->all();

            $topOrganizations = $this->applyFilters(
                AnalyticsEvent::query()
                    ->select(['id', 'properties'])
                    ->orderByRaw($rangeColumn . ' DESC')
                    ->limit(1000),
                $rangeColumn,
                $from,
                $to,
                $focusEvent,
                $sourceFilter,
                $organizationFilter
            )
                ->get()
                ->map(function (AnalyticsEvent $event) {
                    return $this->extractOrganization($event->properties ?? []);
                })
                ->filter()
                ->countBy()
                ->sortDesc()
                ->take(5)
                ->map(function ($count, $name) use ($totalEvents) {
                    $total = (int) $count;

                    return [
                        'organization' => $name,
                        'total' => $total,
                        'percentage' => $totalEvents > 0 ? round(($total / $totalEvents) * 100, 1) : null,
                    ];
                })
                ->values()
                ->all();

            return [
                'range' => [
                    'from' => $from->toIso8601String(),
                    'to' => $to->toIso8601String(),
                ],
                'events' => $allEvents,
                'timeline' => $timeline,
                'recent' => $recentEvents,
                'meta' => [
                    'focus_event' => $focusEvent,
                    'total' => (int) $totalEvents,
                    'average_per_day' => $averagePerDay,
                    'conversion_rate' => $conversionRate,
                        'available_events' => collect($allEvents)
                        ->pluck('event')
                        ->filter()
                        ->values()
                        ->all(),
                    'top_sources' => $topSources,
                    'top_organizations' => $topOrganizations,
                    'active_filters' => array_filter([
                        'source' => $sourceFilter,
                        'organization' => $organizationFilter,
                    ]),
                ],
            ];
        });

        if ($request->query('format') === 'csv') {
            return $this->streamCsvExport($from, $to, $focusEvent, $rangeColumn, $request);
        }

        return response()->json($payload);
    }

    private function resolveFrom(Request $request, Carbon $fallbackTo): Carbon
    {
        $defaultFrom = $fallbackTo->copy()->subDays(7);
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

    private function resolveEvent(Request $request): ?string
    {
        $event = $request->query('event');

        if (! $event) {
            return null;
        }

        $event = trim((string) $event);

        if ($event === '') {
            return null;
        }

        return substr($event, 0, 191);
    }

    private function streamCsvExport(Carbon $from, Carbon $to, ?string $focusEvent, string $rangeColumn, Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $limit = (int) $request->query('limit', 500);
        $limit = max(50, min($limit, 5000));

        $sourceFilter = $this->resolveStringQuery($request, 'source');
        $organizationFilter = $this->resolveStringQuery($request, 'organization');

        $exportQuery = $this->applyFilters(
            AnalyticsEvent::query()
                ->select(['id', 'event', 'properties', 'source', 'received_at', 'created_at'])
                ->orderByRaw($rangeColumn . ' DESC')
                ->limit($limit),
            $rangeColumn,
            $from,
            $to,
            $focusEvent,
            $sourceFilter,
            $organizationFilter
        );

        $filename = sprintf(
            'lead-telemetry-%s-%s.csv',
            $from->format('Ymd'),
            $to->format('Ymd')
        );

        return response()->streamDownload(function () use ($exportQuery) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['event', 'occurred_at', 'source', 'organization', 'properties']);

            foreach ($exportQuery->cursor() as $row) {
                $occurredAt = $row->received_at ?? $row->created_at;
                $organization = $this->extractOrganization($row->properties ?? []);

                fputcsv($handle, [
                    $row->event,
                    $occurredAt ? Carbon::parse($occurredAt)->toIso8601String() : '',
                    $row->source,
                    $organization ?? '',
                    $row->properties ? json_encode($row->properties) : '',
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    /**
     * @psalm-return int<5, 500>
     */
    private function resolveRecentLimit(Request $request): int
    {
        $limit = (int) $request->query('limit', 5);

        return max(5, min($limit, 500));
    }

    private function resolveStringQuery(Request $request, string $key): ?string
    {
        $value = $request->query($key);

        if (! $value) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : substr($value, 0, 191);
    }

    private function extractOrganization(?array $properties): ?string
    {
        if (! $properties) {
            return null;
        }

        foreach (['org_slug', 'organization', 'company', 'company_name'] as $key) {
            if (! empty($properties[$key])) {
                return (string) $properties[$key];
            }
        }

        return null;
    }

    private function applyFilters(
        \Illuminate\Database\Eloquent\Builder $query,
        string $rangeColumn,
        Carbon $from,
        Carbon $to,
        ?string $focusEvent,
        ?string $sourceFilter,
        ?string $organizationFilter
    ): \Illuminate\Database\Eloquent\Builder {
        $query->whereRaw($rangeColumn . ' BETWEEN ? AND ?', [$from, $to])
            ->when($focusEvent, function (\Illuminate\Database\Eloquent\Builder $builder) use ($focusEvent) {
                $builder->where('event', $focusEvent);
            })
            ->when($sourceFilter, function (\Illuminate\Database\Eloquent\Builder $builder) use ($sourceFilter) {
                $builder->where('source', $sourceFilter);
            })
            ->when($organizationFilter, function (\Illuminate\Database\Eloquent\Builder $builder) use ($organizationFilter) {
                $builder->where(function (\Illuminate\Database\Eloquent\Builder $organizationQuery) use ($organizationFilter) {
                    $organizationQuery
                        ->whereJsonContains('properties->org_slug', $organizationFilter)
                        ->orWhereJsonContains('properties->organization', $organizationFilter)
                        ->orWhereJsonContains('properties->company', $organizationFilter)
                        ->orWhereJsonContains('properties->company_name', $organizationFilter);
                });
            });

        return $query;
    }
}

