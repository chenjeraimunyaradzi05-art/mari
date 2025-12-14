<?php

namespace App\Notifications\ProfileVerification;

use App\Models\ProfileVerification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class ProfileVerificationReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly ProfileVerification $verification,
        private readonly int $daysBeforeExpiry
    ) {
        $this->onConnection(config('profile_verification.queue_connection', config('queue.default')));
        $queue = config('profile_verification.automation.reminders.queue');
        if ($queue) {
            $this->onQueue($queue);
        }
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    private function verificationUrl(): ?string
    {
        try {
            return route('account.personas.verification.show', $this->verification->profile_id);
        } catch (\Throwable) {
            return config('app.url');
        }
    }
}

