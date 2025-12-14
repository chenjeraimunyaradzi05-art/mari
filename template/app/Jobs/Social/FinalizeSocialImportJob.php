<?php

namespace App\Jobs\Social;

use App\Models\SocialImportJob;
use App\Models\SocialIntegration;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;

final class FinalizeSocialImportJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    public function __construct(public int $importJobId, public array $items)
    {
        $this->connection = config('social.queue.connection', config('queue.default'));
        $this->queue = config('social.queue.imports', 'social-imports');
    }
}

