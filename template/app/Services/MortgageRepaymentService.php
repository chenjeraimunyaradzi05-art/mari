<?php

declare(strict_types=1);

namespace App\Services;

final class MortgageRepaymentService
{
    /**
     * Calculate repayment amount in cents for a given loan configuration.
     */
    public function calculateRepaymentCents(
        int $principalCents,
        float $annualInterestRate,
        int $loanTermMonths,
        string $frequency = 'monthly'
    ): int {
        $principal = $principalCents / 100;
        $periodsPerYear = match ($frequency) {
            'weekly' => 52,
            'fortnightly' => 26,
            default => 12,
        };

        $periodicRate = $annualInterestRate / 100 / $periodsPerYear;
        $totalPeriods = max(1, (int) round(($loanTermMonths / 12) * $periodsPerYear));

        if ($periodicRate <= 0) {
            $repayment = $principal / $totalPeriods;
        } else {
            $repayment = $principal * ($periodicRate / (1 - pow(1 + $periodicRate, -$totalPeriods)));
        }

        return (int) round($repayment * 100);
    }

    public function estimateRiskRating(float $depositRatio): string
    {
        if ($depositRatio >= 0.2) {
            return 'low';
        }

        if ($depositRatio >= 0.1) {
            return 'medium';
        }

        return 'high';
    }
}

