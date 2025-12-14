<?php

namespace App\Services\Integrations\TurboTax;

/**
 * IntegrationGateway
 *
 * Minimal POC-level integration gateway responsible for normalizing ATHENA's TaxContext
 * into TurboTax payloads, and for contacting a remote TurboTax sandbox (here mocked).
 *
 * Real implementation responsibilities:
 *  - Token management (OAuth2)
 *  - Request signing/retries
 *  - Transformations and validation
 *  - Audit logging and error handling
 */
class IntegrationGateway
{
    protected TurboTaxClient $client;

    public function __construct(TurboTaxClient $client = null)
    {
        $this->client = $client ?? new TurboTaxClient();
    }

    /**
     * Convert ATHENA TaxContext into a TurboTax-style payload for projection API.
     */
    public function buildPayloadFromTaxContext(array $taxContext): array
    {
        // Very small example mapping — real mapping would be much more comprehensive.
        $payload = [
            'person' => [
                'name' => $taxContext['name'] ?? null,
                'ssn' => $taxContext['ssn'] ?? null,
                'filing_status' => $taxContext['filing_status'] ?? 'single',
            ],
            'incomes' => [],
            'expenses' => [],
            'rental_properties' => [],
        ];

        if (!empty($taxContext['income_sources'])) {
            foreach ($taxContext['income_sources'] as $src) {
                $payload['incomes'][] = [
                    'type' => $src['type'] ?? 'other',
                    'amount' => $src['amount'] ?? 0.0,
                    'source' => $src['source'] ?? null,
                ];
            }
        }

        if (!empty($taxContext['biz_expenses'])) {
            foreach ($taxContext['biz_expenses'] as $exp) {
                $payload['expenses'][] = [
                    'category' => $exp['category'] ?? 'other',
                    'amount' => $exp['amount'] ?? 0.0,
                ];
            }
        }

        if (!empty($taxContext['rentals'])) {
            foreach ($taxContext['rentals'] as $r) {
                $payload['rental_properties'][] = [
                    'address' => $r['address'] ?? null,
                    'net_income' => $r['net_income'] ?? 0.0,
                ];
            }
        }

        return $payload;
    }

    /**
     * Simulate sending payload to TurboTax projection endpoint — in a POC we'll
     * return a mocked response containing estimated_tax and per-category breakdown.
     */
    public function sendProjection(array $payload): array
    {
        // If client integration existed we'd call $this->client->calculateTax($payload)
        // For this POC we return a deterministic mocked response based on payload totals

        $totalIncome = 0.0;
        foreach ($payload['incomes'] as $i) {
            $totalIncome += floatval($i['amount'] ?? 0.0);
        }
        foreach ($payload['rental_properties'] as $r) {
            $totalIncome += floatval($r['net_income'] ?? 0.0);
        }

        $totalExpenses = 0.0;
        foreach ($payload['expenses'] as $e) {
            $totalExpenses += floatval($e['amount'] ?? 0.0);
        }

        $taxableIncome = max(0, $totalIncome - $totalExpenses);

        // Very simple tax calculation for POC
        $estimatedTax = round($taxableIncome * 0.15, 2); // flat 15% for demo

        $breakdown = [
            'total_income' => $totalIncome,
            'total_expenses' => $totalExpenses,
            'taxable_income' => $taxableIncome,
            'estimated_tax' => $estimatedTax,
            'by_category' => [
                'income_tax' => $estimatedTax,
            ],
        ];

        return $breakdown;
    }
}
