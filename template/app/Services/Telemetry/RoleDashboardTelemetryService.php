<?php

namespace App\Services\Telemetry;

use App\Models\AnalyticsEvent;
use Carbon\Carbon;

final class RoleDashboardTelemetryService
{
    /**
     * @return (((float|int|string)[][]|float|int|string)[]|string)[][]
     *
     * @psalm-return array{range: array{from: string, to: string}, series: list<array{avg_widgets_per_session: float, daily: list<array{avg_widgets_per_session: float(0), date: string, unique_members: 0, views: 0}>, role: non-empty-string, total_views: 0|1|2, unique_members: int<0, max>}>}
     */
    public function adoptionTrend(int $windowDays = 14): array
    {
        $windowDays = $this->clamp($windowDays, 1, 90);
        $to = Carbon::today();
        $from = (clone $to)->subDays($windowDays - 1);

        $events = AnalyticsEvent::query()
            ->select(['id', 'properties', 'received_at', 'created_at'])
            ->where('event', 'role_dashboard.viewed')
            ->whereRaw('DATE(COALESCE(received_at, created_at)) BETWEEN ? AND ?', [
                $from->toDateString(),
                $to->toDateString(),
            ])
            ->get();

        $series = [];

        foreach ($events as $event) {
            $occurredAt = ($event->received_at ?? $event->created_at) ?: Carbon::now();
            $dateKey = $occurredAt->toDateString();
            $properties = $event->properties ?? [];
            $role = (string) ($properties['role'] ?? '');

            if ($role === '') {
                continue;
            }

            $widgetCount = (float) ($properties['widget_count'] ?? 0);
            $userId = isset($properties['user_id']) ? (string) $properties['user_id'] : null;

            if (! isset($series[$role])) {
                $series[$role] = [
                    'role' => $role,
                    'totals' => [
                        'views' => 0,
                        'unique_members' => [],
                        'widget_count_sum' => 0.0,
                    ],
                    'daily' => [],
                ];
            }

            $series[$role]['totals']['views']++;
            $series[$role]['totals']['widget_count_sum'] += $widgetCount;

            if ($userId) {
                $series[$role]['totals']['unique_members'][$userId] = true;
            }

            if (! isset($series[$role]['daily'][$dateKey])) {
                $series[$role]['daily'][$dateKey] = [
                    'date' => $dateKey,
                    'views' => 0,
                    'unique_members' => [],
                    'widget_count_sum' => 0.0,
                ];
            }

            $daily = &$series[$role]['daily'][$dateKey];
            $daily['views']++;
            $daily['widget_count_sum'] += $widgetCount;

            if ($userId) {
                $daily['unique_members'][$userId] = true;
            }
        }

        $payload = array_map(function (array $roleRow) {
            $daily = array_map(function (array $dayRow) {
                $views = max(1, $dayRow['views']);

                return [
                    'date' => $dayRow['date'],
                    'views' => $dayRow['views'],
                    'unique_members' => count($dayRow['unique_members']),
                    'avg_widgets_per_session' => round($dayRow['widget_count_sum'] / $views, 2),
                ];
            }, $roleRow['daily']);

            usort($daily, fn ($a, $b) => strcmp($a['date'], $b['date']));

            $totalViews = $roleRow['totals']['views'];
            $totalWidgets = $roleRow['totals']['widget_count_sum'];

            return [
                'role' => $roleRow['role'],
                'total_views' => $totalViews,
                'unique_members' => count($roleRow['totals']['unique_members']),
                'avg_widgets_per_session' => $totalViews > 0 ? round($totalWidgets / $totalViews, 2) : 0.0,
                'daily' => $daily,
            ];
        }, $series);

        usort($payload, fn ($a, $b) => $b['total_views'] <=> $a['total_views']);

        return [
            'range' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
            'series' => array_values($payload),
        ];
    }

    /**
     * @return (((((float|int|string)[]|float|int)[]|string)[]|string)[]|float|int)[]
     *
     * @psalm-return array{range: array{from: string, to: string}, threshold_ms: 1|float, roles: list<array{role: non-empty-string, totals: array{breach_rate_percent: float, render_events: int<0, max>}, widgets: list<array{avg_duration_ms: float, breach_rate_percent: float, max_duration_ms: float, p95_duration_ms: float, render_events: int<1, max>, widget_key: non-empty-string}>}>}
     */
    public function widgetSlaSnapshot(int $windowDays = 7, float $thresholdMs = 400): array
    {
        $windowDays = $this->clamp($windowDays, 1, 30);
        $thresholdMs = max(1, $thresholdMs);

        $to = Carbon::today();
        $from = (clone $to)->subDays($windowDays - 1);

        $events = AnalyticsEvent::query()
            ->select(['id', 'properties', 'received_at', 'created_at'])
            ->where('event', 'role_dashboard.widget.rendered')
            ->whereRaw('DATE(COALESCE(received_at, created_at)) BETWEEN ? AND ?', [
                $from->toDateString(),
                $to->toDateString(),
            ])
            ->get();

        $roles = [];

        foreach ($events as $event) {
            $properties = $event->properties ?? [];
            $role = (string) ($properties['role'] ?? '');
            $widget = (string) ($properties['widget_key'] ?? '');
            $duration = isset($properties['duration_ms']) ? (float) $properties['duration_ms'] : null;

            if ($role === '' || $widget === '' || $duration === null || $duration <= 0) {
                continue;
            }

            if (! isset($roles[$role][$widget])) {
                $roles[$role][$widget] = [
                    'durations' => [],
                    'breaches' => 0,
                ];
            }

            $roles[$role][$widget]['durations'][] = $duration;

            if ($duration > $thresholdMs) {
                $roles[$role][$widget]['breaches']++;
            }
        }

        $rolePayload = [];

        foreach ($roles as $role => $widgets) {
            $widgetRows = [];
            $roleRenderTotal = 0;
            $roleBreachTotal = 0;

            foreach ($widgets as $widgetKey => $stats) {
                $durations = $stats['durations'];
                $renderCount = count($durations);

                if ($renderCount === 0) {
                    continue;
                }

                sort($durations);
                $avg = array_sum($durations) / $renderCount;
                $max = max($durations);
                $p95 = $this->percentile($durations, 0.95);
                $breachRate = $stats['breaches'] > 0
                    ? round(($stats['breaches'] / $renderCount) * 100, 2)
                    : 0.0;

                $widgetRows[] = [
                    'widget_key' => $widgetKey,
                    'render_events' => $renderCount,
                    'avg_duration_ms' => round($avg, 2),
                    'p95_duration_ms' => round($p95, 2),
                    'max_duration_ms' => round($max, 2),
                    'breach_rate_percent' => $breachRate,
                ];

                $roleRenderTotal += $renderCount;
                $roleBreachTotal += $stats['breaches'];
            }

            usort($widgetRows, fn ($a, $b) => $b['render_events'] <=> $a['render_events']);

            $rolePayload[] = [
                'role' => $role,
                'totals' => [
                    'render_events' => $roleRenderTotal,
                    'breach_rate_percent' => $roleRenderTotal > 0
                        ? round(($roleBreachTotal / $roleRenderTotal) * 100, 2)
                        : 0.0,
                ],
                'widgets' => $widgetRows,
            ];
        }

        usort($rolePayload, fn ($a, $b) => $b['totals']['render_events'] <=> $a['totals']['render_events']);

        return [
            'range' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
            'threshold_ms' => $thresholdMs,
            'roles' => $rolePayload,
        ];
    }

    private function clamp(int $value, int $min, int $max): int
    {
        return max($min, min($value, $max));
    }

    private function percentile(array $values, float $percentile): float
    {
        $count = count($values);

        if ($count === 0) {
            return 0.0;
        }

        $percentile = max(0, min(1, $percentile));
        $index = ($count - 1) * $percentile;
        $lower = (int) floor($index);
        $upper = (int) ceil($index);

        if ($lower === $upper) {
            return $values[$lower];
        }

        $fraction = $index - $lower;

        return $values[$lower] + ($values[$upper] - $values[$lower]) * $fraction;
    }
}

