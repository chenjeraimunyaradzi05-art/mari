<?php

namespace App\Console\Commands\Advertising;

use App\Models\AdvertisingCampaignMetric;
use App\Models\AdvertisingSlot;
use App\Models\AdvertisingSlotRevenueSnapshot;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Arr;

final class ReconcileSlotRevenue extends Command
{
    protected $signature = 'advertising:reconcile-slot-revenue {--date=}';

    protected $description = 'Aggregate slot-level delivery data for finance and partner readiness dashboards';
}

