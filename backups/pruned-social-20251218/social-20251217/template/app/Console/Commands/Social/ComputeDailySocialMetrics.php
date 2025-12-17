<?php

namespace App\Console\Commands\Social;

use App\Services\Social\SocialMetricsEtlPipeline;
use App\Support\Etl\EtlContext;
use Carbon\Carbon;
use Illuminate\Console\Command;

final class ComputeDailySocialMetrics extends Command
{
    protected $signature = 'social:metrics-daily {date? : Target date (YYYY-MM-DD)} {--persona= : Restrict aggregation to a specific persona/profile id} {--force : Recompute even when a record already exists}';

    protected $description = 'Aggregate daily social graph metrics into the social_metrics_daily fact table.';
}

