<?php

namespace Database\Seeders;

use App\Models\BusinessBudget;
use App\Models\BusinessBudgetLine;
use App\Models\BusinessCashbook;
use App\Models\BusinessCashbookEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;

final class BusinessFinanceDemoSeeder extends Seeder
{
    public function run(): void
    {
        // If there is a business cashbook already, seed entries for it,
        // otherwise skip to keep the demo seeding non-destructive.
        $cashbook = BusinessCashbook::query()->first();
        if (! $cashbook) {
            return;
        }

        $this->seedEntries($cashbook);
        $this->seedBudget($cashbook);
        return;
    }


    private function seedEntries(BusinessCashbook $cashbook): void
    {
        $startOfSeries = Carbon::now()->startOfWeek()->subWeeks(11);

        foreach (range(0, 11) as $index) {
            $weekDate = $startOfSeries->copy()->addWeeks($index);
            $incomeAmount = 4200 + ($index * 75);
            $expenseAmount = 2700 + ($index * 55);

            $cashbook->entries()->create([
                'date' => $weekDate->toDateString(),
                'entry_type' => 'income',
                'category' => 'consulting',
                'description' => 'Recurring consulting retainers',
                'amount' => $incomeAmount,
                'is_tax_deductible' => false,
                'metadata' => [
                    'gst_amount' => round($incomeAmount / 11, 2),
                    'transaction_type' => 'income',
                ],
            ]);

            $cashbook->entries()->create([
                'date' => $weekDate->copy()->addDays(2)->toDateString(),
                'entry_type' => 'expense',
                'category' => 'software',
                'description' => 'SaaS + tooling spend',
                'amount' => $expenseAmount,
                'is_tax_deductible' => true,
                'metadata' => [
                    'gst_amount' => round($expenseAmount / 11, 2),
                    'transaction_type' => 'operating_expense',
                ],
            ]);
        }

        // Add a capital purchase so the asset register + GST credits have data.
        $assetAmount = 7800;
        $cashbook->entries()->create([
            'date' => Carbon::now()->subWeeks(5)->toDateString(),
            'entry_type' => 'expense',
            'category' => 'capital_asset',
            'description' => 'Studio equipment refresh',
            'amount' => $assetAmount,
            'is_tax_deductible' => true,
            'metadata' => [
                'gst_amount' => round($assetAmount / 11, 2),
                'transaction_type' => 'asset_purchase',
            ],
        ]);
    }

    private function seedBudget(BusinessCashbook $cashbook): void
    {
        $periodStart = Carbon::now()->startOfMonth();
        $budget = BusinessBudget::query()->create([
            'business_cashbook_id' => $cashbook->id,
            'period_start' => $periodStart,
            'period_end' => $periodStart->copy()->endOfMonth(),
            'title' => 'Monthly Operating Plan',
            'currency' => $cashbook->currency,
            'auto_rollover' => true,
        ]);

        $lines = [
            [
                'line_type' => 'income',
                'category' => 'consulting',
                'label' => 'Consulting retainers',
                'planned_amount' => 18000,
                'sort_order' => 1,
            ],
            [
                'line_type' => 'income',
                'category' => 'digital_products',
                'label' => 'Template shop',
                'planned_amount' => 4500,
                'sort_order' => 2,
            ],
            [
                'line_type' => 'expense',
                'category' => 'software',
                'label' => 'Software + tooling',
                'planned_amount' => 3200,
                'sort_order' => 3,
            ],
            [
                'line_type' => 'expense',
                'category' => 'marketing',
                'label' => 'Paid campaigns',
                'planned_amount' => 2500,
                'sort_order' => 4,
            ],
            [
                'line_type' => 'expense',
                'category' => 'team',
                'label' => 'Contractor payments',
                'planned_amount' => 5800,
                'sort_order' => 5,
            ],
        ];

        foreach ($lines as $line) {
            BusinessBudgetLine::query()->create(array_merge($line, [
                'business_budget_id' => $budget->id,
                'notes' => Arr::get($line, 'label').' (demo)',
            ]));
        }
    }
}

