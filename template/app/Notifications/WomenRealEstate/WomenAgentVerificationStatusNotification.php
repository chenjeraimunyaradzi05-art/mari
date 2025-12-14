<?php

declare(strict_types=1);

namespace App\Notifications\WomenRealEstate;

use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

final class WomenAgentVerificationStatusNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly WomenVerifiedAgent $agent,
        private readonly string $status,
        private readonly ?string $comment = null,
    ) {
        $this->afterCommit = true;
        $this->onQueue('notifications');
    }

    /**
     * @return (int|null|string)[]
     *
     * @psalm-return array{agent_id: int, status: string, comment: null|string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'agent_id' => $this->agent->id,
            'status' => $this->status,
            'comment' => $this->comment,
        ];
    }

    /**
     * Notification channels.
     * Keep this minimal for tests: persist in database by default.
     *
     * @param mixed $notifiable
     * @return string[]
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    private function buildIntroLine(): string
    {
        return match ($this->status) {
            'verified' => 'Great news — your WomenRise verification is approved.',
            'pending_information' => 'We need a little more information before we can approve your verification.',
            'pending_compliance' => 'Your verification is now with our compliance specialists for additional review.',
            'rejected' => 'We reviewed your verification and cannot approve it right now.',
            default => 'There is an update to your WomenRise verification status.',
        };
    }
}

