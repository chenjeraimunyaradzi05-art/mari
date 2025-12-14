<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

final class TelemetryDashboardController extends Controller
{
    private const RANGE_COLUMN = 'COALESCE(received_at, created_at)';

    public function mobilityWellness(Request $request): View
    {
        $days = $this->normaliseDays((int) $request->query('days', 14));
        $to = Carbon::now();
        $from = $to->copy()->subDays($days);

        $mobilitySummary = $this->summarizeEvent(
            'home.mobility_suite_rendered',
            $from,
            $to,
            [
                'highlight_count' => 'Highlights per render',
                'financial_track_count' => 'Finance tracks per render',
            ]
        );

        $wellnessSummary = $this->summarizeEvent(
            'wellness.hub_finance_section_rendered',
            $from,
            $to,
            [
                'ai_playlist_count' => 'AI playlists surfaced',
                'financial_track_count' => 'Finance tracks surfaced',
            ]
        );

        $aiContexts = $this->summarizeAiContexts(
            [
                'mobility-ai-guide',
                'wellness-money-calm',
                'wellness-circle-plans',
                'wellness-mobility-support',
                'wellness-fast-hand-off',
            ],
            $from,
            $to
        );

        return view('frontend.telemetry.mobility-wellness', [
            'days' => $days,
            'range' => ['from' => $from, 'to' => $to],
            'mobilitySummary' => $mobilitySummary,
            'wellnessSummary' => $wellnessSummary,
            'aiContexts' => $aiContexts,
        ]);
    }

    /**
     * @return (((float|int|mixed|null|string)[]|mixed)[]|Carbon|float|int|null|string)[]
     *
     * @psalm-return array{event: string, total: int<min, max>, unique_users: int<0, max>, auth_rate: float|null, averages: list{0?: array{label: mixed, value: float|null},...}, timeline: array<int, array{date: string, iso: string, total: int}>, latest_properties: array|null, last_seen: Carbon|null}
     */
    private function summarizeEvent(string $event, Carbon $from, Carbon $to, array $averageKeys = []): array
    {
        $baseQuery = AnalyticsEvent::query()
            ->where('event', $event)
            ->whereBetween(DB::raw(self::RANGE_COLUMN), [$from, $to]);

        $total = (clone $baseQuery)->count();

        $lastEvent = (clone $baseQuery)
            ->orderByDesc(DB::raw(self::RANGE_COLUMN))
            ->first();

        $timeline = (clone $baseQuery)
            ->selectRaw('DATE('.self::RANGE_COLUMN.') as day')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->map(function ($row) {
                $date = Carbon::parse($row->day);

                return [
                    'date' => $date->format('M j'),
                    'iso' => $date->toDateString(),
                    'total' => (int) $row->total,
                ];
            })
            ->all();

        $uniqueUsers = [];
        $authHits = 0;
        $averageSums = [];
        $averageCounts = [];

        foreach (array_keys($averageKeys) as $key) {
            $averageSums[$key] = 0;
            $averageCounts[$key] = 0;
        }

        $this->iterateEventProperties(clone $baseQuery, function (array $properties) use (&$uniqueUsers, &$authHits, &$averageSums, &$averageCounts) {
            $userId = data_get($properties, 'user_id');
            if ($userId !== null) {
                $uniqueUsers[$userId] = true;
            }

            if (data_get($properties, 'is_authenticated')) {
                $authHits++;
            }

            foreach ($averageSums as $key => $sum) {
                $value = data_get($properties, $key);

                if (is_numeric($value)) {
                    $averageSums[$key] += (float) $value;
                    $averageCounts[$key]++;
                }
            }
        });

        $averages = [];
        foreach ($averageKeys as $key => $label) {
            $averages[] = [
                'label' => $label,
                'value' => $averageCounts[$key] > 0
                    ? round($averageSums[$key] / $averageCounts[$key], 2)
                    : null,
            ];
        }

        $authRate = $total > 0 ? round(($authHits / $total) * 100, 1) : null;

        $latestProperties = is_array($lastEvent?->properties ?? null)
            ? $lastEvent->properties
            : [];

        $lastSeen = null;
        if ($lastEvent) {
            $lastSeen = ($lastEvent->received_at ?? $lastEvent->created_at) ?? null;
        }

        return [
            'event' => $event,
            'total' => $total,
            'unique_users' => count($uniqueUsers),
            'auth_rate' => $authRate,
            'averages' => $averages,
            'timeline' => $timeline,
            'latest_properties' => $latestProperties,
            'last_seen' => $lastSeen,
        ];
    }

    /**
     * @return (Carbon|float|int|mixed|null)[][]
     *
     * @psalm-return array<int, array{context: mixed, total: int, unique_users: int<0, max>, avg_prompt_length: float|null, history_rate: float|null, last_seen: Carbon|null}>
     */
    private function summarizeAiContexts(array $contexts, Carbon $from, Carbon $to): array
    {
        $contextStats = [];

        foreach ($contexts as $context) {
            $contextStats[$context] = [
                'context' => $context,
                'total' => 0,
                'unique_users' => [],
                'history_hits' => 0,
                'prompt_sum' => 0,
                'prompt_count' => 0,
                'last_seen' => null,
            ];
        }

        AnalyticsEvent::query()
            ->where('event', 'ai.concierge.question_sent')
            ->whereBetween(DB::raw(self::RANGE_COLUMN), [$from, $to])
            ->select(['id', 'properties', 'received_at', 'created_at'])
            ->orderBy('id')
            ->chunkById(500, function ($events) use (&$contextStats) {
                foreach ($events as $row) {
                    $properties = is_array($row->properties) ? $row->properties : [];
                    $contextKey = data_get($properties, 'context_key');

                    if (! isset($contextStats[$contextKey])) {
                        continue;
                    }

                    $contextStats[$contextKey]['total']++;

                    $userId = data_get($properties, 'user_id');
                    if ($userId !== null) {
                        $contextStats[$contextKey]['unique_users'][$userId] = true;
                    }

                    $promptLength = (int) data_get($properties, 'prompt_length', 0);
                    if ($promptLength > 0) {
                        $contextStats[$contextKey]['prompt_sum'] += $promptLength;
                        $contextStats[$contextKey]['prompt_count']++;
                    }

                    if (data_get($properties, 'used_history_payload')) {
                        $contextStats[$contextKey]['history_hits']++;
                    }

                    $occurredAt = $row->received_at ?? $row->created_at;
                    if ($occurredAt && (! $contextStats[$contextKey]['last_seen'] || $occurredAt->gt($contextStats[$contextKey]['last_seen']))) {
                        $contextStats[$contextKey]['last_seen'] = $occurredAt;
                    }
                }
            });

        return collect($contextStats)
            ->map(function (array $stats) {
                $total = $stats['total'];
                $avgPrompt = $stats['prompt_count'] > 0
                    ? round($stats['prompt_sum'] / $stats['prompt_count'], 1)
                    : null;
                $historyRate = $total > 0 ? round(($stats['history_hits'] / $total) * 100, 1) : null;

                return [
                    'context' => $stats['context'],
                    'total' => $total,
                    'unique_users' => count($stats['unique_users']),
                    'avg_prompt_length' => $avgPrompt,
                    'history_rate' => $historyRate,
                    'last_seen' => $stats['last_seen'],
                ];
            })
            ->values()
            ->all();
    }

    private function iterateEventProperties(Builder $query, callable $callback): void
    {
        $query
            ->select(['id', 'properties'])
            ->orderBy('id')
            ->chunkById(500, function ($events) use ($callback) {
                foreach ($events as $row) {
                    $properties = is_array($row->properties) ? $row->properties : [];
                    $callback($properties);
                }
            });
    }

    private function normaliseDays(int $days): int
    {
        $allowed = [7, 14, 30, 90];

        if (! in_array($days, $allowed, true)) {
            return 14;
        }

        return $days;
    }
}

