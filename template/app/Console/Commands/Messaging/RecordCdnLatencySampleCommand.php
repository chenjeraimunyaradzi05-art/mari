<?php

declare(strict_types=1);

namespace App\Console\Commands\Messaging;

use App\Jobs\Messaging\RecordCdnLatencySampleJob;
use Illuminate\Console\Command;

final class RecordCdnLatencySampleCommand extends Command
{
    protected $signature = 'messaging:cdn:sample
        {--count=1 : Number of latency samples to record sequentially}
        {--sync : Run the samples inline without queueing}';

    protected $description = 'Record CDN latency samples used by messaging metadata.';
}

