<?php

namespace App\Observers;

use App\Models\SocialPostPoll;
use App\Services\AIContentService;

final class SocialPostPollObserver
{


    protected function applyModeration(SocialPostPoll $poll): void
    {
        $service = app(AIContentService::class);
        $result = $service->moderateContent($poll->question ?? '');

        $poll->ai_moderation_meta = array_merge($poll->ai_moderation_meta ?? [], [
            'safe' => $result['safe'] ?? true,
            'flags' => $result['flags'] ?? [],
            'checked_at' => now()->toIso8601String(),
        ]);
    }
}

