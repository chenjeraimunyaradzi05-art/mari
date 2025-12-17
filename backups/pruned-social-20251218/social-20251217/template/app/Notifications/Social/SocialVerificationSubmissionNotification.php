<?php

namespace App\Notifications\Social;

use App\Enums\SocialVerificationStatus;
use App\Models\SocialProfileVerification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class SocialVerificationSubmissionNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly SocialProfileVerification $verification)
    {
        $this->onConnection(config('social.queue.connection', config('queue.default')));
    }
}

