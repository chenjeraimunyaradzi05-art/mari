<?php

declare(strict_types=1);

namespace App\Notifications\WomenRealEstate;

use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class WomenAgentLicenseExpiryReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly WomenVerifiedAgent $agent,
        private readonly CarbonImmutable $expiresAt,
        private readonly int $daysBeforeExpiry
    ) {
        $this->afterCommit = true;
        $this->onQueue(config('women_real_estate.reminders.queue', 'notifications'));
    }

    /**
     * Determine the notification channels.
     *
     * @param  mixed  $notifiable
     * @return string[]
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * @return (int|string)[]
     *
     * @psalm-return array{agent_id: int, license_expires_at: string, days_before_expiry: int}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'agent_id' => $this->agent->id,
            'license_expires_at' => $this->expiresAt->toIso8601String(),
            'days_before_expiry' => $this->daysBeforeExpiry,
        ];
    }
}

