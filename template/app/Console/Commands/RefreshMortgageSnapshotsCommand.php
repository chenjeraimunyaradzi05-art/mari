<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Jobs\RefreshMortgageRateSnapshotsJob;
use App\Services\MortgageSnapshotIngestionService;
use Illuminate\Bus\Dispatcher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Bus;

final class RefreshMortgageSnapshotsCommand extends Command
{
    protected $signature = 'mortgage:snapshots:refresh
        {--region=AU : Target market region to refresh}
        {--limit= : Limit the number of templates to process}
        {--queued : Dispatch as queued job instead of running inline}';

    protected $description = 'Refresh mortgage rate snapshots for the WomenRise mortgage intelligence beta.';

    public function handle(MortgageSnapshotIngestionService $snapshotIngestionService): int
    {
        $region = (string) $this->option('region');
        $limit = $this->option('limit');
        $targetRecords = $limit !== null ? (int) $limit : null;

        if ($this->option('queued')) {
            Bus::dispatch(new RefreshMortgageRateSnapshotsJob($region, $targetRecords));
            $this->info("Refresh job dispatched for region {$region} on queue 'mortgage-intel'.");
            return self::SUCCESS;
        }

        $result = $snapshotIngestionService->refreshForRegion($region, $targetRecords);

        $this->info(sprintf(
            'Snapshots refreshed for %s — %d processed (%d created, %d updated).',
            $result['region'],
            $result['total'],
            $result['created'],
            $result['updated']
        ));

        return self::SUCCESS;
    }
}

