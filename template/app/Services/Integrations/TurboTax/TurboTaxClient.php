<?php

namespace App\Services\Integrations\TurboTax;

/**
 * Lightweight scaffold for a TurboTax integration client.
 *
 * This is a minimal implementation to provide the integration surface.
 * Concrete implementations should handle HTTP requests, token storage, rate limiting,
 * error handling and mapping between ATHENA payloads and TurboTax schemas.
 */
class TurboTaxClient
{
    protected string $clientId;
    protected string $clientSecret;

    public function __construct(string $clientId = '', string $clientSecret = '')
    {
        $this->clientId = $clientId;
        $this->clientSecret = $clientSecret;
    }

    /**
     * Exchange credentials / code for an access token in the Intuit/TurboTax API.
     * Placeholder for OAuth2 token exchange.
     */
    public function authenticate(array $params = []): array
    {
        // TODO: implement OAuth2 exchange using Intuit's endpoints.
        return [
            'access_token' => null,
            'refresh_token' => null,
            'expires_in' => null,
        ];
    }

    /**
     * Perform a tax projection / calculation for a provided TaxContext.
     * This should call the TurboTax projection endpoint where available.
     */
    public function calculateTax(array $taxContext): array
    {
        // TODO: translate $taxContext to TurboTax API payload and call the endpoint
        return [
            'estimated_tax' => 0.0,
            'breakdown' => [],
        ];
    }

    /**
     * Create a draft tax return on TurboTax for user to review (if supported).
     */
    public function createDraftReturn(array $payload): array
    {
        // TODO: POST to TurboTax filings endpoint (sandbox) and return draft id / status
        return ['draft_id' => null, 'status' => 'not_implemented'];
    }

    /**
     * Submit a tax return for e-file (if permitted by partnership).
     */
    public function submitReturn(string $draftId, array $options = []): array
    {
        // TODO: call filing endpoint and return status and remote id
        return ['status' => 'not_implemented', 'filing_id' => null];
    }
}
