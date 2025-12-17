<?php

namespace App\Jobs\Social;

use App\Models\SocialLiveStream;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class StreamEngagementIngestJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public int $socialLiveStreamId,
        public array $metrics
    ) {
        $this->onQueue(config('social.streams.metrics_queue', 'social-feed'));
    }
}

