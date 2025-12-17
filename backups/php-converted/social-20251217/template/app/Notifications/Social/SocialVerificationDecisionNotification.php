<?php

namespace App\Notifications\Social;

use App\Enums\SocialVerificationStatus;
use App\Models\SocialProfileVerification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

final class SocialVerificationDecisionNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly SocialProfileVerification $verification)
    {
        $this->onConnection(config('social.queue.connection', config('queue.default')));
    }

    /**
     * Determine which channels the notification should be delivered on.
     *
     * @param  mixed  $notifiable
     * @return array<int, string>
     */
    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $url = route('social.profiles.verification.show', $this->verification->profile?->username ?: '#');

        return (new MailMessage())
            ->subject('Your verification request has been reviewed')
            ->greeting('Hello')
            ->line('A reviewer has completed a decision on your verification request.')
            ->action('View request', $url)
            ->line('Thank you for using our platform.');
    }
}

