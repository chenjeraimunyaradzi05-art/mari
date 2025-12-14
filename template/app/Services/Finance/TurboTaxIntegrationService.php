<?php

namespace App\Services\Finance;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Lightweight TurboTax integration service (POC).
 *
 * - This is a minimal scaffold for making calls to an Intuit/TurboTax sandbox API.
 * - Do not store PII in plaintext. Use vault/encrypted storage in production.
 */
class TurboTaxIntegrationService
{
    /** Base URL for Intuit/TurboTax API (sandbox or production) */
    protected string $baseUrl;

    /** OAuth client ID registered with Intuit (POC) */
    protected ?string $clientId;

    /** OAuth client secret registered with Intuit (POC) */
    protected ?string $clientSecret;

    public function __construct()
    {
        $this->baseUrl = env('INTUIT_API_BASE', 'https://sandbox.intuit.com');
        $this->clientId = env('INTUIT_CLIENT_ID');
        $this->clientSecret = env('INTUIT_CLIENT_SECRET');
    }

    /**
     * Build a sanitized payload for an estimate request.
     * Accepts the minimal business-friendly inputs.
     *
     * @param array $payload
     * @return array
     */
    public function buildEstimatePayload(array $payload): array
    {
        return array_merge([ 
            'request_id' => Str::uuid()->toString(),
            'source' => 'ATHENA',
        ], $payload);
    }

    /**
     * Request a tax estimate from TurboTax (sandbox).
     * For POC, we return a falsible response if the INTUIT_API_BASE is not set.
     *
     * @param array $payload
     * @return array
     */
    public function estimateTax(array $payload): array
    {
        // Ensure the feature is enabled
        if (!config('features.turbotax_integration')) {
            return [
                'ok' => false,
                'message' => 'TurboTax integration feature is disabled',
            ];
        }

        $body = $this->buildEstimatePayload($payload);

        // In production, exchange tokens via OAuth and use secure storage
        if (empty($this->clientId) || str_contains($this->baseUrl, 'sandbox') === false) {
            // Return a mockable estimate for local dev/demo
            return $this->mockEstimate($body);
        }

        // Example call — implement actual OAuth flow and correct endpoints in production
        $response = Http::withHeaders([
            'Accept' => 'application/json',
        ])->post($this->baseUrl . '/tax/estimate', $body);

        if ($response->failed()) {
            return [
                'ok' => false,
                'status' => $response->status(),
                'message' => $response->body(),
            ];
        }

        return [
            'ok' => true,
            'payload' => $response->json(),
        ];
    }

    /**
     * Submit a filing-ready payload (POC).
     */
    public function submitFiling(array $payload): array
    {
        // Keep this as a stub for POC. Use idempotency keys and secure channels in production.
        return [
            'ok' => true,
            'ticket' => Str::uuid()->toString(),
            'message' => 'Filing submitted to POC queue (mock)'
        ];
    }

    protected function mockEstimate(array $body): array
    {
        // A small mock of typical tax results. Replace with real API responses later.
        $grossIncome = data_get($body, 'gross_income', 60000);
        $deductions = data_get($body, 'deductions', 8000);
        $taxable = max(0, $grossIncome - $deductions);

        $estTax = round($taxable * 0.12, 2); // quick mock rate for example

        return [
            'ok' => true,
            'payload' => [
                'taxable_income' => $taxable,
                'estimated_tax' => $estTax,
                'confidence' => 'mock:low',
                'explanation' => 'This is a POC mock response. Use real TurboTax API in production.'
            ]
        ];
    }
}
