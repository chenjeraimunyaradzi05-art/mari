<?php

namespace App\Services\Mortgage;

/**
 * Advanced Mortgage Data Enrichment Service
 * Enhances mortgage data with final additional insights and calculations
 */
final class MortgageEnrichmentService
{
    /**
     * Enrich mortgage data with additional insights.
     *
     * @return (\Illuminate\Support\Carbon|float|mixed|string)[]
     *
     * @psalm-return array{debt_to_income_ratio: float, loan_to_value_ratio: float, estimated_approval_probability: float, risk_level: string, enriched_at: \Illuminate\Support\Carbon,...}
     */
    public function enrich(array $data): array
    {
        return [
            ...$data,
            'debt_to_income_ratio' => $this->calculateDebtToIncome($data),
            'loan_to_value_ratio' => $this->calculateLTV($data),
            'estimated_approval_probability' => $this->estimateApprovalProbability($data),
            'risk_level' => $this->assessRiskLevel($data),
            'enriched_at' => now(),
        ];
    }

    protected function calculateDebtToIncome(array $data): float
    {
        // Example: Calculate debt-to-income ratio
        $monthlyIncome = $data['monthly_income'] ?? 5000;
        $monthlyDebts = $data['monthly_debts'] ?? 1000;
        return round(($monthlyDebts / $monthlyIncome) * 100, 2);
    }

    protected function calculateLTV(array $data): float
    {
        // Example: Calculate Loan-to-Value ratio
        $loanAmount = $data['amount'] ?? 300000;
        $propertyValue = $data['property_value'] ?? 400000;
        return round(($loanAmount / $propertyValue) * 100, 2);
    }

    protected function estimateApprovalProbability(array $data): float
    {
        // Example: Estimate approval probability based on data
        $score = $data['credit_score'] ?? 650;
        $probability = min(100, ($score / 850) * 100);
        return round($probability, 2);
    }

    protected function assessRiskLevel(array $data): string
    {
        $score = $data['credit_score'] ?? 650;
        if ($score >= 750) return 'low';
        if ($score >= 650) return 'moderate';
        return 'high';
    }
}
