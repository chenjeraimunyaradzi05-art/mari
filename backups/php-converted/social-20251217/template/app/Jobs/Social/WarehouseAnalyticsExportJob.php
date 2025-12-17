<?php

namespace App\Jobs\Social;

use App\Models\AnalyticsEvent;
use App\Services\Analytics\DataWarehouseExporter;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class WarehouseAnalyticsExportJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    protected string $exportQueue;

    public function __construct(
        public int $lastEventId = 0,
        public int $batchSize = 500
    ) {
        $config = config('social.analytics');
        $this->exportQueue = $config['queue'] ?? 'analytics';
        $this->onQueue($this->exportQueue);
        $this->batchSize = max(50, $this->batchSize);
    }
}

