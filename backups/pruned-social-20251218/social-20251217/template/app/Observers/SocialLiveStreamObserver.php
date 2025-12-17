<?php

namespace App\Observers;

use App\Models\SocialLiveStream;
use App\Services\AIContentService;

final class SocialLiveStreamObserver
{


    protected function applyModeration(SocialLiveStream $stream): void
    {
        $service = app(AIContentService::class);
        $context = is_array($stream->stream_context) ? json_encode($stream->stream_context) : (string) $stream->stream_context;
        $payload = trim(($stream->title ?? '').' '.$context);
        $result = $service->moderateContent($payload);

        $stream->ai_moderation_meta = array_merge($stream->ai_moderation_meta ?? [], [
            'safe' => $result['safe'] ?? true,
            'flags' => $result['flags'] ?? [],
            'checked_at' => now()->toIso8601String(),
        ]);
    }
}

