<?php

namespace App\Services\Social;

use Illuminate\Support\Facades\Log;

final class SocialEngagementAiBridge
{
    public function dispatch(array $payload): void
    {
        Log::debug('Social engagement AI hook prepared.', $payload);
    }
}

