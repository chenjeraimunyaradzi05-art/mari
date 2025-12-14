<?php

namespace App\Notifications\ProfileVerification;

use App\Models\ProfileVerification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class ProfileVerificationSubmittedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly ProfileVerification $verification)
    {
        $this->onConnection(config('profile_verification.queue_connection', config('queue.default')));
    }
}

