<?php

namespace App\Jobs;

use App\Services\RealTimeAnalyticsEngine;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class PersistAnalyticsEvent implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly string $event,
        public readonly array $payload
    ) {
    }

    /**
     * @return string[]
     *
     * @psalm-return list{'analytics', string}
     */
    public function tags(): array
    {
        return [
            'analytics',
            'analytics:event:'.$this->event,
        ];
    }
}

