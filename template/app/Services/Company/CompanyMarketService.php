<?php

namespace App\Services\Company;

use App\Models\Company;
use Illuminate\Support\Facades\Log;

final class CompanyMarketService
{
    /**
     * Sync market rates for all companies.
     * Simulates stock price fluctuations and market cap updates.
     */
    public function syncMarketRates(): void
    {
        $companies = Company::all();

        foreach ($companies as $company) {
            $this->updateCompanyMarketData($company);
        }

        Log::info('Company market data synced successfully.');
    }

    /**
     * Update market data for a single company.
     */
    private function updateCompanyMarketData(Company $company): void
    {
        // Initialize or update stock price
        $currentPrice = $company->stock_price ?? rand(10, 500);

        // Simulate fluctuation (-5% to +5%)
        $fluctuation = rand(-500, 500) / 10000; // -0.05 to 0.05
        $newPrice = $currentPrice * (1 + $fluctuation);

        // Ensure price doesn't go below 1
        $newPrice = max(1, $newPrice);

        // Calculate daily change percentage
        $changePercentage = (($newPrice - $currentPrice) / $currentPrice) * 100;

        // If it's a new initialization, set change to 0 or random
        if (!$company->stock_price) {
            $changePercentage = rand(-200, 200) / 100; // -2% to +2%
        }

        // Update Market Cap (Simulated: Price * Random Shares)
        // Assuming shares count is constant-ish, but for simulation we just scale it.
        // Let's say shares = 1,000,000 to 100,000,000
        $shares = 10000000; // 10 million shares
        $marketCap = $newPrice * $shares;

        $company->update([
            'stock_price' => $newPrice,
            'market_cap' => $marketCap,
            'daily_change_percentage' => $changePercentage,
            'last_market_update' => now(),
        ]);
    }
}

