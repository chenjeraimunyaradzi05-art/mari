<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\BudgetCategory;
use App\Models\BudgetProfile;
use App\Models\BudgetTransaction;
use App\Models\DebtSubmission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

final class FinancialWellnessSeeder extends Seeder
{
    public function run(): void
    {
        // Keep the seeding light — create a minimal debt-submission scenario
        $this->seedDebtSubmission();
        return;
    }


    private function seedDebtSubmission(): void
    {
        $debts = [
            ['name' => 'NAB Business Loan', 'balance' => 58_000, 'rate' => 8.2, 'min_payment' => 980],
            ['name' => 'Equipment Lease', 'balance' => 12_000, 'rate' => 9.5, 'min_payment' => 420],
            ['name' => 'Credit Card', 'balance' => 8_500, 'rate' => 18.5, 'min_payment' => 260],
        ];

        $totalBalance = collect($debts)->sum('balance');
        $currentPayment = collect($debts)->sum('min_payment');

        $plans = [
            ['rate' => 7.4, 'term_months' => 60],
            ['rate' => 6.8, 'term_months' => 48],
        ];

        $scenarios = collect($plans)->map(function (array $plan) use ($totalBalance, $currentPayment) {
            $monthlyPayment = $this->amortisedPayment($totalBalance, $plan['rate'], $plan['term_months']);
            $totalPaid = $monthlyPayment * $plan['term_months'];
            $totalInterest = $totalPaid - $totalBalance;
            $savings = ($currentPayment - $monthlyPayment) * $plan['term_months'];

            return [
                'rate' => $plan['rate'],
                'term_months' => $plan['term_months'],
                'monthly_payment' => round($monthlyPayment, 2),
                'total_paid' => round($totalPaid, 2),
                'total_interest' => round($totalInterest, 2),
                'savings_vs_current' => round($savings, 2),
            ];
        })->all();

        DebtSubmission::updateOrCreate(
            ['profile_name' => 'Athena Sole Trader'],
            [
                'submission_source' => 'seeder',
                'debts' => $debts,
                'scenarios' => $scenarios,
                'total_balance_cents' => (int) round($totalBalance * 100),
                'current_payment_cents' => (int) round($currentPayment * 100),
            ]
        );
    }

    private function amortisedPayment(float $balance, float $annualRatePercent, int $termMonths): float
    {
        if ($termMonths <= 0 || $balance <= 0) {
            return 0.0;
        }

        $monthlyRate = ($annualRatePercent / 100) / 12;

        if ($monthlyRate === 0.0) {
            return $balance / $termMonths;
        }

        $factor = pow(1 + $monthlyRate, $termMonths);

        return $balance * ($monthlyRate * $factor) / ($factor - 1);
    }
}

