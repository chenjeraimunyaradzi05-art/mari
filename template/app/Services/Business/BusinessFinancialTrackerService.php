<?php

namespace App\Services\Business;

use App\Models\BusinessCashbook;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class BusinessFinancialTrackerService
{
    public function buildForUser(int $userId, string $timeframe = 'monthly'): array
    {
        /** @var User|null $user */
        $user = User::query()->with(['defaultBusinessCashbook', 'businessCashbooks'])->find($userId);

        if (! $user) {
            return $this->emptyPayload($timeframe);
        }

        $cashbook = $user->defaultBusinessCashbook ?? $user->businessCashbooks->first();

        if (! $cashbook) {
            return $this->emptyPayload($timeframe);
        }

        return $this->buildForCashbook($cashbook, $timeframe);
    }

    /**
     * @return array[]
     *
     * @psalm-return array{period: array{label: string, from: string, to: string}, profit_and_loss: array, budget_vs_actual: array, cashflow_projection: array, category_breakdown: array, gst: array, deductibles: array, assets: array, balance_sheet: array, journals: array}
     */
    public function buildForCashbook(BusinessCashbook $cashbook, string $timeframe): array
    {
        [$from, $to] = $this->resolvePeriod($timeframe);

        $entries = $cashbook->entries()
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('date')
            ->get();

        $budgets = $cashbook->budgets()
            ->with('lines')
            ->where('period_start', '<=', $to)
            ->where('period_end', '>=', $from)
            ->get();

        $profitAndLoss = $this->buildProfitAndLoss($entries);
        $cashflowSeries = $this->buildCashflowSeries($entries, $from, $to, $timeframe);
        $categoryBreakdown = $this->buildCategoryBreakdown($entries);
        $budgetTotals = $this->buildBudgetTotals($budgets);
        $gst = $this->buildGstSummary($entries);
        $deductibles = $this->buildDeductibleSummary($entries);
        $assets = $this->buildAssetRegister($entries);
        $balanceSheet = $this->buildBalanceSheet($profitAndLoss, $assets, $gst);
        $journals = $this->sampleJournals($gst, $timeframe);

        return [
            'period' => [
                'label' => ucfirst($timeframe),
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
            'profit_and_loss' => $profitAndLoss,
            'budget_vs_actual' => $this->buildBudgetComparison($profitAndLoss, $budgetTotals),
            'cashflow_projection' => $this->buildCashflowProjection($cashflowSeries, $profitAndLoss, $timeframe, $to),
            'category_breakdown' => $categoryBreakdown,
            'gst' => $gst,
            'deductibles' => $deductibles,
            'assets' => $assets,
            'balance_sheet' => $balanceSheet,
            'journals' => $journals,
        ];
    }

    /**
     * @return Carbon[]
     *
     * @psalm-return list{Carbon, Carbon}
     */
    private function resolvePeriod(string $timeframe): array
    {
        return match ($timeframe) {
            'weekly' => [now()->startOfWeek(), now()->endOfWeek()],
            'quarterly' => [now()->startOfQuarter(), now()->endOfQuarter()],
            'yearly' => [now()->startOfYear(), now()->endOfYear()],
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };
    }

    /**
     * @return (((int|string)|float)[][]|float|int)[]
     *
     * @psalm-return array{income_total: float, expense_total: float, net_profit: float, income_breakdown: array<int, array{category: array-key, amount: float, percentage: 0|float}>, expense_breakdown: array<int, array{category: array-key, amount: float, percentage: 0|float}>, margin: 0|float}
     */
    private function buildProfitAndLoss(Collection $entries): array
    {
        $income = $entries->where('entry_type', 'income')->sum('amount');
        $expense = $entries->where('entry_type', 'expense')->sum('amount');
        $net = $income - $expense;

        $groupedIncome = $entries->where('entry_type', 'income')
            ->groupBy('category')
            ->map(fn ($group, $category) => [
                'category' => $category,
                'amount' => round($group->sum('amount'), 2),
                'percentage' => $income > 0 ? round(($group->sum('amount') / $income) * 100, 1) : 0,
            ])
            ->values()
            ->all();

        $groupedExpense = $entries->where('entry_type', 'expense')
            ->groupBy('category')
            ->map(fn ($group, $category) => [
                'category' => $category,
                'amount' => round($group->sum('amount'), 2),
                'percentage' => $expense > 0 ? round(($group->sum('amount') / $expense) * 100, 1) : 0,
            ])
            ->values()
            ->all();

        return [
            'income_total' => round($income, 2),
            'expense_total' => round($expense, 2),
            'net_profit' => round($net, 2),
            'income_breakdown' => $groupedIncome,
            'expense_breakdown' => $groupedExpense,
            'margin' => $income > 0 ? round(($net / $income) * 100, 1) : 0,
        ];
    }

    /**
     * @return (float|string)[][]
     *
     * @psalm-return list{0?: array{label: string, income: float, expenses: float},...}
     */
    private function buildCashflowSeries(Collection $entries, Carbon $from, Carbon $to, string $timeframe): array
    {
        $interval = match ($timeframe) {
            'weekly' => 'D',
            'quarterly', 'yearly' => 'M',
            default => 'W',
        };

        $cursor = $from->copy();
        $series = [];

        while ($cursor <= $to) {
            $bucketEnd = match ($interval) {
                'D' => $cursor->copy(),
                'M' => $cursor->copy()->endOfMonth(),
                default => $cursor->copy()->endOfWeek(),
            };

            $bucketEntries = $entries->whereBetween('date', [$cursor->toDateString(), $bucketEnd->toDateString()]);
            $series[] = [
                'label' => $cursor->format($interval === 'D' ? 'D M' : 'M d'),
                'income' => round($bucketEntries->where('entry_type', 'income')->sum('amount'), 2),
                'expenses' => round($bucketEntries->where('entry_type', 'expense')->sum('amount'), 2),
            ];

            $cursor = match ($interval) {
                'D' => $cursor->addDay(),
                'M' => $cursor->startOfMonth()->addMonth(),
                default => $cursor->addWeek(),
            };
        }

        return $series;
    }

    /**
     * @return ((int|string)|float)[][]
     *
     * @psalm-return array<int, array{category: array-key, amount: float, percentage: float}>
     */
    private function buildCategoryBreakdown(Collection $entries): array
    {
        $totals = $entries->groupBy('category')->map(fn ($group) => round($group->sum('amount'), 2));
        $grandTotal = $totals->sum() ?: 1;

        return $totals
            ->map(fn ($amount, $category) => [
                'category' => $category ?? 'Uncategorised',
                'amount' => $amount,
                'percentage' => round(($amount / $grandTotal) * 100, 1),
            ])
            ->values()
            ->all();
    }

    /**
     * @return float[]
     *
     * @psalm-return array{income?: float, expenses?: float}
     */
    private function buildBudgetTotals(Collection $budgets): array
    {
        if ($budgets->isEmpty()) {
            return [];
        }

        $lines = $budgets->flatMap(fn ($budget) => $budget->lines);

        return [
            'income' => round($lines->where('line_type', 'income')->sum('planned_amount'), 2),
            'expenses' => round($lines->where('line_type', 'expense')->sum('planned_amount'), 2),
        ];
    }

    /**
     * @return (array|null)[]
     *
     * @psalm-return array{planned: array|null, variance: array{income: float, expenses: float}|null}
     */
    private function buildBudgetComparison(array $profitAndLoss, array $budgetTotals): array
    {
        if ($budgetTotals === []) {
            return [
                'planned' => null,
                'variance' => null,
            ];
        }

        $incomeVariance = $profitAndLoss['income_total'] - $budgetTotals['income'];
        $expenseVariance = $profitAndLoss['expense_total'] - $budgetTotals['expenses'];

        return [
            'planned' => $budgetTotals,
            'variance' => [
                'income' => round($incomeVariance, 2),
                'expenses' => round($expenseVariance, 2),
            ],
        ];
    }

    /**
     * @return (array|float|string)[]
     *
     * @psalm-return array{current: float, projected: float, trend: 'down'|'up', next_check: string, series: array}
     */
    private function buildCashflowProjection(array $series, array $profitAndLoss, string $timeframe, Carbon $periodEnd): array
    {
        $net = $profitAndLoss['net_profit'];
        $averageDelta = collect($series)
            ->map(fn ($data) => $data['income'] - $data['expenses'])
            ->average() ?? 0;

        $projectionWeeks = match ($timeframe) {
            'weekly' => 1,
            'quarterly' => 13,
            'yearly' => 52,
            default => 4,
        };

        $projected = $net + ($averageDelta * $projectionWeeks);
        $trend = $projected >= $net ? 'up' : 'down';

        return [
            'current' => round($net, 2),
            'projected' => round($projected, 2),
            'trend' => $trend,
            'next_check' => $periodEnd->copy()->addWeek()->toDateString(),
            'series' => $series,
        ];
    }

    /**
     * @return (float|string)[]
     *
     * @psalm-return array{collected: float, paid: float, net: float, clearing_balance: float, status: 'payable'|'refundable'}
     */
    private function buildGstSummary(Collection $entries): array
    {
        $gstCollected = $entries
            ->where('entry_type', 'income')
            ->sum(fn ($entry) => (float) Arr::get($entry->metadata, 'gst_amount', 0));

        $gstPaid = $entries
            ->where('entry_type', 'expense')
            ->sum(fn ($entry) => (float) Arr::get($entry->metadata, 'gst_amount', 0));

        $net = $gstCollected - $gstPaid;

        return [
            'collected' => round($gstCollected, 2),
            'paid' => round($gstPaid, 2),
            'net' => round($net, 2),
            'clearing_balance' => round($net, 2),
            'status' => $net >= 0 ? 'payable' : 'refundable',
        ];
    }

    /**
     * @return ((float|mixed|null)[][]|float)[]
     *
     * @psalm-return array{deductible_total: float, non_deductible_total: float, recent_items: array<int, array{date: mixed|null, category: mixed, amount: float}>}
     */
    private function buildDeductibleSummary(Collection $entries): array
    {
        $deductible = $entries->where('is_tax_deductible', true);
        $nonDeductible = $entries->where('is_tax_deductible', false)->where('entry_type', 'expense');

        return [
            'deductible_total' => round($deductible->sum('amount'), 2),
            'non_deductible_total' => round($nonDeductible->sum('amount'), 2),
            'recent_items' => $deductible
                ->sortByDesc('date')
                ->take(5)
                ->map(fn ($entry) => [
                    'date' => $entry->date?->toDateString(),
                    'category' => $entry->category,
                    'amount' => round($entry->amount, 2),
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @return ((float|mixed|null)[][]|float|int)[]
     *
     * @psalm-return array{count: int, total_value: float, items: array<int, array{name: mixed, amount: float, date: mixed|null, gst_claimed: float}>}
     */
    private function buildAssetRegister(Collection $entries): array
    {
        $assetEntries = $entries->filter(function ($entry) {
            $type = Arr::get($entry->metadata, 'transaction_type');
            return $type === 'asset_purchase' || Str::contains(strtolower((string) $entry->category), 'asset');
        });

        return [
            'count' => $assetEntries->count(),
            'total_value' => round($assetEntries->sum('amount'), 2),
            'items' => $assetEntries->map(fn ($entry) => [
                'name' => $entry->description ?? $entry->category,
                'amount' => round($entry->amount, 2),
                'date' => $entry->date?->toDateString(),
                'gst_claimed' => round((float) Arr::get($entry->metadata, 'gst_amount', 0), 2),
            ])->values()->all(),
        ];
    }

    /**
     * @return (float|int|mixed)[][]
     *
     * @psalm-return array{assets: array{cash: float, capital_assets: mixed, gst_refundable: float|int<0, max>}, liabilities: array{gst_payable: 0|mixed}, equity: array{retained_earnings: float}}
     */
    private function buildBalanceSheet(array $profitAndLoss, array $assets, array $gst): array
    {
        $cash = max(0, $profitAndLoss['net_profit']);
        $liabilities = max(0, $gst['net']);
        $equity = $cash - $liabilities;

        return [
            'assets' => [
                'cash' => round($cash, 2),
                'capital_assets' => $assets['total_value'],
                'gst_refundable' => $gst['net'] < 0 ? abs($gst['net']) : 0,
            ],
            'liabilities' => [
                'gst_payable' => $liabilities,
            ],
            'equity' => [
                'retained_earnings' => round($equity, 2),
            ],
        ];
    }

    /**
     * @return ((float|int|string)[][]|string)[][]
     *
     * @psalm-return list{array{date: string, description: 'Record BAS payment to clear GST payable.'|'Record BAS refund from ATO to clear GST receivable.', entries: list{array{account: 'Bank'|'GST Clearing', debit: float, credit: 0}, array{account: 'Bank'|'GST Clearing', debit: 0, credit: float}}, timeframe: string}}
     */
    private function sampleJournals(array $gst, string $timeframe): array
    {
        $balance = $gst['net'];
        $description = $balance >= 0
            ? 'Record BAS payment to clear GST payable.'
            : 'Record BAS refund from ATO to clear GST receivable.';

        return [
            [
                'date' => now()->toDateString(),
                'description' => $description,
                'entries' => $balance >= 0
                    ? [
                        ['account' => 'GST Clearing', 'debit' => round($balance, 2), 'credit' => 0],
                        ['account' => 'Bank', 'debit' => 0, 'credit' => round($balance, 2)],
                    ]
                    : [
                        ['account' => 'Bank', 'debit' => round(abs($balance), 2), 'credit' => 0],
                        ['account' => 'GST Clearing', 'debit' => 0, 'credit' => round(abs($balance), 2)],
                    ],
                'timeframe' => $timeframe,
            ],
        ];
    }

    /**
     * @return (int|int[]|null|string)[][]
     *
     * @psalm-return array{period: array{label: string, from: string, to: string}, profit_and_loss: array{income_total: 0, expense_total: 0, net_profit: 0, income_breakdown: array<never, never>, expense_breakdown: array<never, never>, margin: 0}, budget_vs_actual: array{planned: null, variance: null}, cashflow_projection: array{current: 0, projected: 0, trend: 'flat', next_check: string, series: array<never, never>}, category_breakdown: array<never, never>, gst: array{collected: 0, paid: 0, net: 0, clearing_balance: 0, status: 'payable'}, deductibles: array{deductible_total: 0, non_deductible_total: 0, recent_items: array<never, never>}, assets: array{count: 0, total_value: 0, items: array<never, never>}, balance_sheet: array{assets: array{cash: 0, capital_assets: 0, gst_refundable: 0}, liabilities: array{gst_payable: 0}, equity: array{retained_earnings: 0}}, journals: array<never, never>}
     */
    private function emptyPayload(string $timeframe): array
    {
        return [
            'period' => [
                'label' => ucfirst($timeframe),
                'from' => now()->startOfMonth()->toDateString(),
                'to' => now()->endOfMonth()->toDateString(),
            ],
            'profit_and_loss' => [
                'income_total' => 0,
                'expense_total' => 0,
                'net_profit' => 0,
                'income_breakdown' => [],
                'expense_breakdown' => [],
                'margin' => 0,
            ],
            'budget_vs_actual' => [
                'planned' => null,
                'variance' => null,
            ],
            'cashflow_projection' => [
                'current' => 0,
                'projected' => 0,
                'trend' => 'flat',
                'next_check' => now()->addWeek()->toDateString(),
                'series' => [],
            ],
            'category_breakdown' => [],
            'gst' => [
                'collected' => 0,
                'paid' => 0,
                'net' => 0,
                'clearing_balance' => 0,
                'status' => 'payable',
            ],
            'deductibles' => [
                'deductible_total' => 0,
                'non_deductible_total' => 0,
                'recent_items' => [],
            ],
            'assets' => [
                'count' => 0,
                'total_value' => 0,
                'items' => [],
            ],
            'balance_sheet' => [
                'assets' => ['cash' => 0, 'capital_assets' => 0, 'gst_refundable' => 0],
                'liabilities' => ['gst_payable' => 0],
                'equity' => ['retained_earnings' => 0],
            ],
            'journals' => [],
        ];
    }
}

