<?php

namespace App\Console\Commands\Impact;

use App\Models\ImpactIndexSnapshot;
use App\Services\Impact\ImpactAnalyticsService;
use Illuminate\Console\Command;

final class CaptureImpactIndexSnapshotCommand extends Command
{
    protected $signature = 'impact:snapshots:capture
        {--timeframe=daily : Timeframe window (daily, weekly, monthly, quarterly, yearly)}
        {--publish=1 : Whether to mark the snapshot as public}';

    protected $description = 'Capture an Impact Index snapshot using the latest aggregates.';
}

