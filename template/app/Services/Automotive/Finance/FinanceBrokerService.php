<?php

namespace App\Services\Automotive\Finance;

use App\Models\FinanceApplication;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class FinanceBrokerService
{
    /**
     * Submit an application to a panel of lenders.
     * In a real scenario, this would call an aggregator API.
     */
    public function submitApplication(FinanceApplication $application): void
    {
        // 1. Prepare Payload
        $payload = [
            'applicant_id' => $application->user_id,
            'amount' => $application->loan_amount,
            'term' => $application->term_months,
            'income' => $application->annual_income,
            'employment' => $application->employment_status,
            'vehicle_id' => $application->vehicle_listing_id,
        ];

        // 2. Mock API Call (Simulating external partner)
        // $response = Http::post('https://api.lender-aggregator.com/v1/submit', $payload);

        // Simulate success for now
        $mockResponse = [
            'status' => 'received',
            'reference_id' => 'FIN-' . uniqid(),
            'estimated_rate' => '5.99%',
            'message' => 'Application received. A broker will contact you shortly.',
        ];

        Log::info("Finance Application Submitted", ['id' => $application->id, 'payload' => $payload]);

        // 3. Update Application Status
        $application->update([
            'status' => 'submitted',
            'provider_responses' => array_merge($application->provider_responses ?? [], ['initial_submission' => $mockResponse]),
        ]);
    }
}

