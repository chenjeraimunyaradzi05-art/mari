<?php

namespace App\Notifications\Social;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class MediaScanFailedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $sessionUuid,
        private readonly int $userId,
        private readonly ?string $mediaType,
        private readonly ?string $storagePath,
        private readonly string $errorMessage
    ) {
        $this->onConnection(config('social.queue.connection', config('queue.default')));
    }
}

