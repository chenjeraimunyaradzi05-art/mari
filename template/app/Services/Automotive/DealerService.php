<?php

namespace App\Services\Automotive;

use App\Models\Dealer;
use Illuminate\Support\Facades\Log;

final class DealerService
{


    public function verifyDealer(Dealer $dealer): void
    {
        $dealer->update(['is_verified' => true]);
        // Send notification to dealer
    }

    public function approveDealer(Dealer $dealer): void
    {
        $dealer->update(['is_dealer_approved' => true]);
    }

    protected function initiateVerification(Dealer $dealer): void
    {
        // Placeholder for external verification logic
        Log::info("Initiating verification for dealer: {$dealer->name}");
    }
}

