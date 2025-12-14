<?php

namespace App\Services\Automotive\Insurance;

use App\Models\InsuranceQuote;
use Illuminate\Support\Facades\Log;

final class InsuranceBrokerService
{
    /**
     * Request quotes from insurance partners.
     */
    public function requestQuotes(InsuranceQuote $quoteRequest): void
    {
        // 1. Prepare Payload
        $payload = [
            'driver_age' => $quoteRequest->driver_age_range,
            'location' => $quoteRequest->parking_location,
            'usage' => $quoteRequest->usage_type,
            'vehicle_id' => $quoteRequest->vehicle_listing_id,
        ];

        Log::info("Insurance Quote Requested", ['id' => $quoteRequest->id, 'payload' => $payload]);

        // 2. Mock API Response (Simulating multiple providers)
        $mockQuotes = [
            [
                'provider' => 'SafeRoads Insure',
                'premium_monthly' => 85.50,
                'premium_annual' => 950.00,
                'excess' => 800,
                'features' => ['Roadside Assist', 'Windscreen Cover'],
            ],
            [
                'provider' => 'Budget Cover',
                'premium_monthly' => 65.00,
                'premium_annual' => 720.00,
                'excess' => 1200,
                'features' => [],
            ],
            [
                'provider' => 'Premium Shield',
                'premium_monthly' => 110.00,
                'premium_annual' => 1200.00,
                'excess' => 500,
                'features' => ['Roadside Assist', 'Hire Car', 'New for Old'],
            ]
        ];

        // 3. Update Quote Request with results
        $quoteRequest->update([
            'quotes_received' => $mockQuotes,
        ]);
    }
}

