<?php

namespace App\Services\Business;

use App\Models\BusinessCashbook;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

final class BusinessCashbookSummaryService
{
    public function buildSummary(BusinessCashbook $cashbook, array $filters = []): array
    {
        [$from, $to] = $this->resolveRange($filters);
        $cacheKey = $this->cacheKeyForRange($cashbook, $from, $to);

        if (Cache::has($cacheKey)) {
            return Cache::get($cacheKey);
        }

        $summary = $this->calculateSummary($cashbook, $from, $to);

        if ($this->shouldCacheRange($filters)) {
            Cache::put($cacheKey, $summary, now()->addMinutes(30));
        }

        return $summary;
    }

    public function cacheSummary(BusinessCashbook $cashbook, array $filters, array $summary, ?int $ttlMinutes = null): void
    {
        [$from, $to] = $this->resolveRange($filters);
        $cacheKey = $this->cacheKeyForRange($cashbook, $from, $to);
        Cache::put($cacheKey, $summary, now()->addMinutes($ttlMinutes ?? 90));
    }

    /**
     * @return Carbon[]
     *
     * @psalm-return list{Carbon, Carbon}
     */
    private function resolveRange(array $filters): array
    {
        $from = isset($filters['from']) ? Carbon::parse($filters['from']) : now()->startOfMonth();
        $to = isset($filters['to']) ? Carbon::parse($filters['to']) : now();

        return [$from, $to];
    }

    /**
     * @return (float|int|mixed)[][]
     *
     * @psalm-return array{totals: array{income: float, expenses: float, net: float, runway_weeks: 0|float}, series: array{cashflow: mixed, category_breakdown: mixed}, budget_comparison: array<never, never>}
     */
    private function calculateSummary(BusinessCashbook $cashbook, Carbon $from, Carbon $to): array
    {
        $entries = $cashbook->entries()
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('date')
            ->get();

        $income = $entries->where('entry_type', 'income')->sum('amount');
        $expense = $entries->where('entry_type', 'expense')->sum('amount');
        $net = $income - $expense;
        $weeks = max(1, $from->diffInWeeks($to) ?: 1);
        $weeklyBurn = $weeks > 0 ? $expense / $weeks : 0;
        $runwayBase = $income > 0 ? max(0, $income - $expense) : 0;
        $runwayWeeks = $weeklyBurn > 0 ? round($runwayBase / $weeklyBurn, 1) : 0;

        $cashflowSeries = $entries
            ->groupBy(fn ($entry) => Carbon::parse($entry->date)->startOfWeek()->format('Y-m-d'))
            ->map(function ($group, $label) {
                $incomeTotal = $group->where('entry_type', 'income')->sum('amount');
                $expenseTotal = $group->where('entry_type', 'expense')->sum('amount');

                return [
                    'label' => Carbon::parse($label)->format('M d'),
                    'income' => round($incomeTotal, 2),
                    'expenses' => round($expenseTotal, 2),
                ];
            })
            ->values()
            ->all();

        $categoryBreakdown = $entries
            ->groupBy('category')
            ->map(fn ($group, $category) => [
                'category' => $category ?? 'uncategorised',
                'amount' => round($group->sum('amount'), 2),
            ])
            ->values()
            ->all();

        return [
            'totals' => [
                'income' => round($income, 2),
                'expenses' => round($expense, 2),
                'net' => round($net, 2),
                'runway_weeks' => $runwayWeeks,
            ],
            'series' => [
                'cashflow' => $cashflowSeries,
                'category_breakdown' => $categoryBreakdown,
            ],
            'budget_comparison' => [],
        ];
    }

    private function shouldCacheRange(array $filters): bool
    {
        return empty($filters);
    }

    public function cacheKeyForRange(BusinessCashbook $cashbook, Carbon $from, Carbon $to): string
    {
        return sprintf('business_cashbooks:%d:summary:%s_%s', $cashbook->id, $from->format('Ymd'), $to->format('Ymd'));
    }
}

