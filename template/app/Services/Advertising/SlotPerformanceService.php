<?php

namespace App\Services\Advertising;

use App\Models\AdvertisingCampaign;
use App\Models\AdvertisingCampaignMetric;
use App\Models\Company;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class SlotPerformanceService
{
    /** @var array<string, string> */
    private const SLOT_LABELS = [
        'hero-main' => 'Hero headline',
        'feature-strip' => 'Partner strip',
        'onboarding' => 'Onboarding rail',
        'education' => 'Learning hero',
        'feature-grid' => 'Feature grid',
        'gallery' => 'Gallery showcase',
        'pricing' => 'Pricing hero',
        'cta' => 'Final CTA',
    ];

    /**
     * @return (array|null|string)[]
     *
     * @psalm-return array{period: array{from: string, to: string, days: int<3, 60>}, updated_at: string, totals: array{impressions: int, clicks: int, ctr: float}, slots: list<array{alerts?: array, clicks: int, ctr?: float, impressions: int, label: string, series: array<int, array{clicks: int, date: mixed, impressions: int}>, slot: mixed, trend?: array}>, top_slot: array{slot: mixed, label: string, impressions: int, clicks: int, series: array<int, array{date: mixed, impressions: int, clicks: int}>, ctr?: float, trend?: array, alerts?: array}|null, alerts: array<int, mixed>}
     */
    public function forCompany(Company|int $company, int $days = 30): array
    {
        $companyId = $company instanceof Company ? $company->getKey() : (int) $company;

        $metrics = AdvertisingCampaignMetric::query()
            ->whereHas('campaign', fn ($query) => $query->where('company_id', $companyId))
            ->when($days, fn ($query) => $this->scopeDays($query, $days))
            ->orderBy('recorded_at')
            ->get();

        return $this->buildPayload($metrics, $days);
    }

    /**
     * @return (array|null|string)[]
     *
     * @psalm-return array{period: array{from: string, to: string, days: int<3, 60>}, updated_at: string, totals: array{impressions: int, clicks: int, ctr: float}, slots: list<array{alerts?: array, clicks: int, ctr?: float, impressions: int, label: string, series: array<int, array{clicks: int, date: mixed, impressions: int}>, slot: mixed, trend?: array}>, top_slot: array{slot: mixed, label: string, impressions: int, clicks: int, series: array<int, array{date: mixed, impressions: int, clicks: int}>, ctr?: float, trend?: array, alerts?: array}|null, alerts: array<int, mixed>}
     */
    public function forCampaign(AdvertisingCampaign $campaign, int $days = 30): array
    {
        $metrics = $campaign->metrics()
            ->when($days, fn ($query) => $this->scopeDays($query, $days))
            ->orderBy('recorded_at')
            ->get();

        return $this->buildPayload($metrics, $days);
    }

    private function scopeDays($query, int $days)
    {
        $bound = max(3, min(60, $days));
        $end = CarbonImmutable::now()->startOfDay();
        $start = $end->subDays($bound - 1);

        return $query->whereBetween('recorded_at', [$start->toDateString(), $end->toDateString()]);
    }

    /**
     * @return ((((array|float|mixed|null|string)[]|float|int|mixed|null|string)[]|float|int|mixed|string)[]|null|string)[]
     *
     * @psalm-return array{period: array{from: string, to: string, days: int<3, 60>}, updated_at: string, totals: array{impressions: int<min, max>, clicks: int<min, max>, ctr: float}, slots: list<array{alerts?: list{0?: array, 1?: array}, clicks: int<min, max>, ctr?: float, impressions: int<min, max>, label: string, series: array<int, array{clicks: int, date: mixed, impressions: int}>, slot: mixed, trend?: array{delta_percent: float|null, direction: 'down'|'flat'|'up'}}>, top_slot: array{slot: mixed, label: string, impressions: int<min, max>, clicks: int<min, max>, series: array<int, array{date: mixed, impressions: int, clicks: int}>, ctr?: float, trend?: array{direction: 'down'|'flat'|'up', delta_percent: float|null}, alerts?: list{0?: array, 1?: array}}|null, alerts: array<int, array>}
     */
    private function buildPayload(Collection $metrics, int $days): array
    {
        $bound = max(3, min(60, $days));
        $end = CarbonImmutable::now()->startOfDay();
        $start = $end->subDays($bound - 1);

        $slots = [];

        foreach ($metrics as $metric) {
            $slotNotes = Arr::get($metric->notes, 'slots', []);

            foreach ($slotNotes as $slot => $values) {
                $impressions = (int) ($values['impressions'] ?? 0);
                $clicks = (int) ($values['clicks'] ?? 0);

                if ($impressions === 0 && $clicks === 0) {
                    continue;
                }

                if (! isset($slots[$slot])) {
                    $slots[$slot] = [
                        'slot' => $slot,
                        'label' => $this->labelForSlot($slot),
                        'impressions' => 0,
                        'clicks' => 0,
                        'series' => [],
                    ];
                }

                $slots[$slot]['impressions'] += $impressions;
                $slots[$slot]['clicks'] += $clicks;
                $slots[$slot]['series'][] = [
                    'date' => optional($metric->recorded_at)->toDateString(),
                    'impressions' => $impressions,
                    'clicks' => $clicks,
                ];
            }
        }

        $totalImpressions = 0;
        $totalClicks = 0;

        foreach ($slots as $slot => $payload) {
            $series = collect($payload['series'])
                ->filter(fn ($row) => $row['date'] !== null)
                ->sortBy('date')
                ->values();

            $slots[$slot]['series'] = $series->take(-10)->values()->all();
            $slots[$slot]['ctr'] = $payload['impressions'] > 0
                ? round($payload['clicks'] / $payload['impressions'], 4)
                : 0.0;
            $slots[$slot]['trend'] = $this->calculateTrend($series);
            $slots[$slot]['alerts'] = $this->buildSlotAlerts($slots[$slot]);

            $totalImpressions += $payload['impressions'];
            $totalClicks += $payload['clicks'];
        }

        foreach ($slots as $slot => &$payload) {
            $payload['share'] = $totalImpressions > 0
                ? round($payload['impressions'] / $totalImpressions, 4)
                : 0.0;
        }
        unset($payload);

        $slotCollection = collect($slots);
        $topSlot = $slotCollection
            ->filter(fn ($slot) => $slot['impressions'] >= 50)
            ->sort(function (array $a, array $b) {
                $ctrComparison = ($b['ctr'] ?? 0) <=> ($a['ctr'] ?? 0);

                return $ctrComparison !== 0
                    ? $ctrComparison
                    : ($b['impressions'] ?? 0) <=> ($a['impressions'] ?? 0);
            })
            ->first();

        if (! $topSlot) {
            $topSlot = $slotCollection
                ->sort(fn (array $a, array $b) => ($b['impressions'] ?? 0) <=> ($a['impressions'] ?? 0))
                ->first();
        }

        return [
            'period' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
                'days' => $bound,
            ],
            'updated_at' => now()->toIso8601String(),
            'totals' => [
                'impressions' => $totalImpressions,
                'clicks' => $totalClicks,
                'ctr' => $totalImpressions > 0 ? round($totalClicks / $totalImpressions, 4) : 0.0,
            ],
            'slots' => array_values($slots),
            'top_slot' => $topSlot,
            'alerts' => collect($slots)
                ->flatMap(fn ($slot) => $slot['alerts'])
                ->values()
                ->all(),
        ];
    }

    private function labelForSlot(string $slot): string
    {
        if (array_key_exists($slot, self::SLOT_LABELS)) {
            return self::SLOT_LABELS[$slot];
        }

        return Str::of($slot)
            ->replace(['.', '_', '-'], ' ')
            ->squish()
            ->title()
            ->toString();
    }

    /**
     * @param \Illuminate\Support\Collection<int, array{date:string|null,impressions:int,clicks:int}>  $series
     *
     * @return (float|null|string)[]
     *
     * @psalm-return array{direction: 'down'|'flat'|'up', delta_percent: float|null}
     */
    private function calculateTrend(Collection $series): array
    {
        if ($series->isEmpty()) {
            return [
                'direction' => 'flat',
                'delta_percent' => null,
            ];
        }

        $recent = $series->take(-3);
        $previous = $series->slice(-6, 3);

        $recentTotal = (int) $recent->sum('impressions');
        $previousTotal = (int) $previous->sum('impressions');

        if ($previousTotal === 0) {
            return [
                'direction' => $recentTotal > 0 ? 'up' : 'flat',
                'delta_percent' => $recentTotal > 0 ? 1.0 : null,
            ];
        }

        $delta = ($recentTotal - $previousTotal) / max(1, $previousTotal);
        $direction = 'flat';

        if ($delta >= 0.05) {
            $direction = 'up';
        } elseif ($delta <= -0.05) {
            $direction = 'down';
        }

        return [
            'direction' => $direction,
            'delta_percent' => round($delta, 4),
        ];
    }

    /**
     * @return (mixed|string)[][]
     *
     * @psalm-return list{0?: array{slot: mixed, label: mixed, code: string, severity: string, message: string}, 1?: array{slot: mixed, label: mixed, code: string, severity: string, message: string}}
     */
    private function buildSlotAlerts(array $slot): array
    {
        $alerts = [];

        if ($slot['impressions'] >= 150 && $slot['clicks'] === 0) {
            $alerts[] = $this->alertPayload($slot, 'no_clicks', 'critical', sprintf('%s has %s impressions with zero clicks.', $slot['label'], number_format($slot['impressions'])));
        } elseif ($slot['impressions'] >= 150 && $slot['ctr'] < 0.01) {
            $alerts[] = $this->alertPayload($slot, 'low_ctr', 'warning', sprintf('%s CTR %s is below the 1%% benchmark.', $slot['label'], $this->percentString($slot['ctr'])));
        }

        $trend = $slot['trend'] ?? null;
        if ($trend && ($trend['direction'] ?? null) === 'down' && abs($trend['delta_percent'] ?? 0) >= 0.25) {
            $alerts[] = $this->alertPayload(
                $slot,
                'trend_down',
                'warning',
                sprintf('%s impressions down %s vs prior window.', $slot['label'], $this->percentString(abs($trend['delta_percent'] ?? 0)))
            );
        }

        return $alerts;
    }

    /**
     * @return (mixed|string)[]
     *
     * @psalm-return array{slot: mixed, label: mixed, code: string, severity: string, message: string}
     */
    private function alertPayload(array $slot, string $code, string $severity, string $message): array
    {
        return [
            'slot' => $slot['slot'],
            'label' => $slot['label'],
            'code' => $code,
            'severity' => $severity,
            'message' => $message,
        ];
    }

    private function percentString(float $value): string
    {
        return number_format($value * 100, 1) . '%';
    }
}

