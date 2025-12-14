<?php

declare(strict_types=1);

namespace App\Notifications\WomenRealEstate;

use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class WomenAgentReverificationScheduledNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly WomenVerifiedAgent $agent,
        private readonly CarbonImmutable $scheduledFor,
    ) {
        $this->afterCommit = true;
        $this->onQueue('notifications');
    }

    /**
     * @return (int|string)[]
     *
     * @psalm-return array{agent_id: int, scheduled_for: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'agent_id' => $this->agent->id,
            'scheduled_for' => $this->scheduledFor->toIso8601String(),
        ];
    }

    /**
     * Default channels for this notification (database only for test-safety).
     *
     * @param mixed $notifiable
     * @return string[]
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }
}

