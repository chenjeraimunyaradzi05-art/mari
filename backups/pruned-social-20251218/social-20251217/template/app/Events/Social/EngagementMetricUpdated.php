<?php

namespace App\Events\Social;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class EngagementMetricUpdated
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly string $channel,
        public readonly Model $subject,
        public readonly array $meta = []
    ) {
    }
}

