<?php

namespace App\Jobs\Social;

use App\Models\CommerceOrder;
use App\Models\CommercePayoutBatch;
use App\Models\CreatorPayout;
use App\Services\Analytics\DataWarehouseExporter;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

final class DisburseCreatorPayoutsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(public ?int $commerceChannelId = null)
    {
        $this->onQueue(config('social.revenue.queue', 'revenue'));
    }
}

