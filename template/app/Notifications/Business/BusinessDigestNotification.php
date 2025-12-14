<?php

namespace App\Notifications\Business;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;

final class BusinessDigestNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array<string, mixed>  $snapshot
     */
    public function __construct(private array $snapshot)
    {
    }

    private function parseGeneratedAt(): ?Carbon
    {
        $timestamp = Arr::get($this->snapshot, 'generated_at');

        if (! $timestamp) {
            return null;
        }

        try {
            return Carbon::parse($timestamp);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Determine which channels this notification should be sent on.
     *
     * @return list<string>
     */
    public function via($notifiable): array
    {
        // In tests we assert the notification was sent; store in the database
        // so assertions have a concrete channel to validate with.
        return ['database'];
    }

    /**
     * Array representation for the database channel.
     *
     * @return array<string, mixed>
     */
    public function toArray($notifiable): array
    {
        return ['snapshot' => $this->snapshot, 'generated_at' => $this->parseGeneratedAt()?->toIso8601String()];
    }
}

