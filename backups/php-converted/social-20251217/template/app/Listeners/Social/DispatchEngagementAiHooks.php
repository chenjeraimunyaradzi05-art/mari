<?php

namespace App\Listeners\Social;

use App\Events\Social\EngagementMetricUpdated;
use App\Services\Social\SocialEngagementAiBridge;
use Illuminate\Contracts\Queue\ShouldQueue;

final class DispatchEngagementAiHooks implements ShouldQueue
{
    public string $queue = 'ai-hooks';
}

