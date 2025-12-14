<?php

namespace App\Jobs;

use App\Models\BusinessCashbook;
use App\Services\Business\BusinessCashbookSummaryService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

final class SyncCashbookInsights implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public readonly int $cashbookId)
    {
    }

    private function cacheKey(int $cashbookId, string $suffix): string
    {
        return sprintf('business_cashbooks:%d:insights:%s', $cashbookId, $suffix);
    }
}

