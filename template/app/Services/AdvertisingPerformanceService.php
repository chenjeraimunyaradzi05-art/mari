<?php

namespace App\Services;

use App\Models\AdvertisingCampaign;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class AdvertisingPerformanceService
{
    /**
     * @return (Collection|array|mixed|null)[]
     *
     * @psalm-return array{totals: array, averages: array{impressions: float, clicks: float, conversions: float, qualified_leads: float, spend: float}, derived: array{ctr: float, conversion_rate: float, lead_rate: float, cpc: float, cpa: float, roi: float}, best_day: TValue|null, series: Collection, lookback_start: mixed|null}
     */
    public function summarizeCampaign(AdvertisingCampaign $campaign, int $lookbackDays = 30): array
    {
        $lookbackDays = max(1, $lookbackDays);
        $cutoffDate = CarbonImmutable::now()->subDays($lookbackDays - 1)->startOfDay();

        $metricsQuery = $campaign->metrics()->where('recorded_at', '>=', $cutoffDate->toDateString());

        $metrics = $metricsQuery
            ->orderByDesc('recorded_at')
            ->get();

        $totals = $this->accumulateTotals($metrics);

        $daysTracked = max(1, $metrics->count());

        $averages = [
            'impressions' => round($totals['impressions'] / $daysTracked),
            'clicks' => round($totals['clicks'] / $daysTracked),
            'conversions' => round($totals['conversions'] / $daysTracked, 2),
            'qualified_leads' => round($totals['qualified_leads'] / $daysTracked, 2),
            'spend' => round($totals['spend'] / $daysTracked, 2),
        ];

        $derived = [
            'ctr' => $this->safeDivide($totals['clicks'], $totals['impressions']) * 100,
            'conversion_rate' => $this->safeDivide($totals['conversions'], $totals['clicks']) * 100,
            'lead_rate' => $this->safeDivide($totals['qualified_leads'], $totals['clicks']) * 100,
            'cpc' => $this->safeDivide($totals['spend'], $totals['clicks']),
            'cpa' => $this->safeDivide($totals['spend'], $totals['conversions']),
            'roi' => $totals['spend'] > 0
                ? round((($totals['pipeline_value'] - $totals['spend']) / $totals['spend']) * 100, 2)
                : 0.0,
        ];

        $derived = array_map(fn ($value) => round($value, 2), $derived);

        $bestDay = $metrics->sortByDesc('conversions')->first();

        return [
            'totals' => $totals,
            'averages' => $averages,
            'derived' => $derived,
            'best_day' => $bestDay,
            'series' => $metrics->take(14),
            'lookback_start' => $metrics->isEmpty() ? null : $metrics->last()->recorded_at,
        ];
    }

    /**
     * @return (float|int)[]
     *
     * @psalm-return array{impressions: int<min, max>, clicks: int<min, max>, conversions: int<min, max>, qualified_leads: int<min, max>, spend: float, pipeline_value: float}
     */
    private function accumulateTotals(Collection $metrics): array
    {
        $base = [
            'impressions' => 0,
            'clicks' => 0,
            'conversions' => 0,
            'qualified_leads' => 0,
            'spend' => 0.0,
            'pipeline_value' => 0.0,
        ];

        foreach ($metrics as $metric) {
            $base['impressions'] += (int) $metric->impressions;
            $base['clicks'] += (int) $metric->clicks;
            $base['conversions'] += (int) $metric->conversions;
            $base['qualified_leads'] += (int) $metric->qualified_leads;
            $base['spend'] += (float) $metric->spend;
            $base['pipeline_value'] += (float) $metric->pipeline_value;
        }

        $base['spend'] = round($base['spend'], 2);
        $base['pipeline_value'] = round($base['pipeline_value'], 2);

        return $base;
    }

    private function safeDivide(float|int $numerator, float|int $denominator): float
    {
        if ($denominator === 0.0 || $denominator === 0) {
            return 0.0;
        }

        return (float) $numerator / $denominator;
    }
}

