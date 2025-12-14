<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Services\MortgageSnapshotIngestionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

final class RefreshMortgageRateSnapshotsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(private readonly string $region = 'AU', private readonly ?int $targetRecords = null)
    {
        $this->queue = 'mortgage-intel';
    }
}

