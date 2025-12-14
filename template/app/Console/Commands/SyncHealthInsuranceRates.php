<?php

namespace App\Console\Commands;

use App\Services\HealthFitness\HealthInsuranceMarketService;
use Illuminate\Console\Command;

final class SyncHealthInsuranceRates extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'insurance:sync-market-data';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fetch and update health insurance plans with latest market rates';

    /**
     * Execute the console command.
     */
    public function handle(HealthInsuranceMarketService $marketService): void
    {
        $this->info('Fetching latest health insurance market data...');

        try {
            $count = $marketService->syncMarketRates();
            $this->info("Successfully synced {$count} insurance plans.");
        } catch (\Exception $e) {
            $this->error('Failed to sync market data: ' . $e->getMessage());
        }
    }
}

