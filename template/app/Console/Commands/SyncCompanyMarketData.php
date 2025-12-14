<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

final class SyncCompanyMarketData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'company:sync-market-data';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync company market data (stock prices, market cap) based on simulated market fluctuations.';

    /**
     * Execute the console command.
     */
    public function handle(\App\Services\Company\CompanyMarketService $marketService): void
    {
        $this->info('Syncing company market data...');
        $marketService->syncMarketRates();
        $this->info('Company market data synced successfully.');
    }
}

