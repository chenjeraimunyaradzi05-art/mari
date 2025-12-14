<?php

declare(strict_types=1);

namespace App\Notifications\WomenRealEstate;

use App\Models\WomenRealEstate\WomenAgentVerificationAudit;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;
use Throwable;

final class WomenAgentComplianceEscalationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly WomenVerifiedAgent $agent,
        private readonly WomenAgentVerificationAudit $audit,
        private readonly array $notes,
        private readonly ?string $queueUrl = null
    ) {
        $this->afterCommit = true;
        $this->onQueue('notifications');
    }

    private function resolveQueueUrl(): string
    {
        if ($this->queueUrl) {
            return $this->queueUrl;
        }

        try {
            return route('admin.women.verification.queue.index');
        } catch (Throwable) {
            $fallback = config('women_real_estate.compliance.queue_url')
                ?? config('app.url')
                ?? '#';

            return $fallback;
        }
    }

    /**
     * Determine which channels this notification should be sent on.
     *
     * @return string[]
     */
    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $mail = (new MailMessage())
            ->subject(sprintf('Compliance escalation — agent #%d', $this->agent->id))
            ->line('An agent has been escalated to compliance for further review.')
            ->line(sprintf('Audit ID: %d', $this->audit->id));

        $queueUrl = $this->resolveQueueUrl();

        if ($queueUrl) {
            $mail->action('Open compliance queue', $queueUrl);
        }

        return $mail;
    }

}



