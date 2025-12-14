<?php

namespace App\Services;

use App\Models\AdvertisingCampaign;
use Carbon\CarbonImmutable;

class AdvertisingPacingService
{
    /**
     * @return (CarbonImmutable|float|int|mixed|null|string)[]
     *
     * @psalm-return array{start_date: CarbonImmutable, end_date: CarbonImmutable, total_days: 1|float, days_elapsed: 0|float, days_remaining: 0|1|float, total_spend: float, expected_spend_to_date: float, pace_delta: float, status: string, progress_ratio: mixed, avg_daily_spend: float, projected_final_spend: float, remaining_budget: float|null, avg_cpc: float, avg_cpa: float, total_impressions: mixed, total_clicks: mixed, total_conversions: mixed, total_qualified_leads: mixed, recommendation: string}
     */
    public function evaluate(AdvertisingCampaign $campaign): array
    {
        $now = CarbonImmutable::now();
        $start = $this->determineStartDate($campaign, $now);
        $end = $this->determineEndDate($campaign, $start, $now);

        $totalDays = max(1, $start->diffInDays($end) + 1);
        $daysElapsed = max(0, $start->diffInDays(min($now, $end)) + 1);
        $daysRemaining = max(0, $totalDays - $daysElapsed);

        $metrics = $campaign->metrics;
        $totalSpend = $metrics->sum(fn ($metric) => $metric->spend);
        $totalImpressions = $metrics->sum('impressions');
        $totalClicks = $metrics->sum('clicks');
        $totalConversions = $metrics->sum('conversions');
        $totalQualifiedLeads = $metrics->sum('qualified_leads');

        $avgDailySpend = $daysElapsed > 0 ? round($totalSpend / $daysElapsed, 2) : 0.0;
        $avgCpc = $totalClicks > 0 ? round($totalSpend / $totalClicks, 2) : 0.0;
        $avgCpa = $totalConversions > 0 ? round($totalSpend / $totalConversions, 2) : 0.0;

        [$expectedSpend, $progressRatio] = $this->calculateExpectedSpend($campaign, $daysElapsed, $totalDays);
        $paceDelta = round($totalSpend - $expectedSpend, 2);

        $status = $this->determineStatus($paceDelta, $totalSpend, $expectedSpend);
        $recommendation = $this->buildRecommendation($campaign, $status, $avgDailySpend, $daysRemaining, $paceDelta);

        $projectedFinalSpend = round($avgDailySpend * $totalDays, 2);
        $remainingBudget = $campaign->lifetime_budget ? round($campaign->lifetime_budget - $totalSpend, 2) : null;

        return [
            'start_date' => $start,
            'end_date' => $end,
            'total_days' => $totalDays,
            'days_elapsed' => $daysElapsed,
            'days_remaining' => $daysRemaining,
            'total_spend' => round($totalSpend, 2),
            'expected_spend_to_date' => round($expectedSpend, 2),
            'pace_delta' => $paceDelta,
            'status' => $status,
            'progress_ratio' => $progressRatio,
            'avg_daily_spend' => $avgDailySpend,
            'projected_final_spend' => $projectedFinalSpend,
            'remaining_budget' => $remainingBudget,
            'avg_cpc' => $avgCpc,
            'avg_cpa' => $avgCpa,
            'total_impressions' => $totalImpressions,
            'total_clicks' => $totalClicks,
            'total_conversions' => $totalConversions,
            'total_qualified_leads' => $totalQualifiedLeads,
            'recommendation' => $recommendation,
        ];
    }

    private function determineStartDate(AdvertisingCampaign $campaign, CarbonImmutable $now): CarbonImmutable
    {
        if ($campaign->starts_at) {
            return CarbonImmutable::parse($campaign->starts_at)->startOfDay();
        }

        return CarbonImmutable::parse($campaign->created_at ?: $now)->startOfDay();
    }

    private function determineEndDate(AdvertisingCampaign $campaign, CarbonImmutable $start, CarbonImmutable $now): CarbonImmutable
    {
        if ($campaign->ends_at) {
            return CarbonImmutable::parse($campaign->ends_at)->endOfDay();
        }

        if ($campaign->lifetime_budget) {
            // Assume a 30-day flight if no explicit end date for budgeted campaigns.
            return $start->addDays(29)->endOfDay();
        }

        // Open-ended campaign: project 30 days into the future for pacing purposes.
        return max($start, $now)->addDays(29)->endOfDay();
    }

    /**
     * @return float[]
     *
     * @psalm-return list{float, float}
     */
    private function calculateExpectedSpend(AdvertisingCampaign $campaign, int $daysElapsed, int $totalDays): array
    {
        $expected = 0.0;
        $progressRatio = $totalDays > 0 ? $daysElapsed / $totalDays : 0.0;

        if ($campaign->daily_budget) {
            $expected += $campaign->daily_budget * $daysElapsed;
        }

        if ($campaign->lifetime_budget) {
            $expected = max($expected, (float) $campaign->lifetime_budget * $progressRatio);
        }

        return [$expected, round($progressRatio, 3)];
    }

    private function determineStatus(float $paceDelta, float $totalSpend, float $expectedSpend): string
    {
        if ($expectedSpend === 0.0) {
            return $totalSpend > 0 ? 'ahead' : 'no_target';
        }

        $threshold = max(50.0, $expectedSpend * 0.1); // $50 or 10% tolerance.

        if ($paceDelta >= $threshold) {
            return 'ahead';
        }

        if ($paceDelta <= -$threshold) {
            return 'behind';
        }

        return 'on_track';
    }

    private function buildRecommendation(AdvertisingCampaign $campaign, string $status, float $avgDailySpend, int $daysRemaining, float $paceDelta): string
    {
        $dailyBudget = (float) $campaign->daily_budget;

        return match ($status) {
            'ahead' => 'Pacing ahead of plan. Consider reducing daily bids or reallocating excess budget to higher-performing segments.',
            'behind' => $dailyBudget > 0
                ? sprintf(
                    'Pacing behind plan. Increase daily budget to approximately $%s for the next %d days or refresh creatives to improve engagement.',
                    number_format(max($dailyBudget, $avgDailySpend + abs($paceDelta) / max(1, $daysRemaining)), 2),
                    max(0, $daysRemaining)
                )
                : 'Pacing behind plan. Set a daily budget or refresh creatives to lift click volume.',
            'no_target' => 'No pacing target defined. Configure daily or lifetime budgets to unlock pacing insights.',
            default => 'Pacing on track. Monitor lead quality and keep creatives refreshed every 7-10 days.',
        };
    }
}

