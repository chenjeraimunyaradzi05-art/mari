<?php

namespace App\Notifications\Messaging;

use App\Models\SocialMessage;
use App\Models\SocialThread;
use App\Services\Messaging\MessagingPreviewPrivacyGuard;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

final class MessageReceivedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly SocialThread $thread, private readonly SocialMessage $message)
    {
        $this->onConnection(config('social_messaging.queue.connection', config('queue.default')));
        $this->onQueue(config('social_messaging.queue.name', 'notifications'));
    }

    /**
     * @return ((mixed|null|string)[]|bool|mixed|null|string)[]
     *
     * @psalm-return array{type: 'message_received', thread_id: mixed, message_id: mixed, sender: array{id: mixed|null, username: null|string, display_name: null|string}, preview: string, is_redacted: bool, redaction_reason: null|string, sent_at: string}
     */
    public function toArray(object $notifiable): array
    {
        $this->message->loadMissing('sender')->loadCount('attachments');

        $guard = app(MessagingPreviewPrivacyGuard::class);
        $decision = $guard->evaluate(
            $notifiable,
            $this->message->sender,
            $this->thread->getKey(),
            $this->message->getKey(),
            (bool) $this->message->is_system
        );

        $preview = $decision->isRedacted()
            ? '[message hidden]'
            : $this->resolvePreviewText();

        return [
            'type' => 'message_received',
            'thread_id' => $this->thread->getKey(),
            'message_id' => $this->message->getKey(),
            'sender' => [
                'id' => $this->message->sender?->getKey(),
                'username' => $this->message->sender?->username,
                'display_name' => $this->message->sender?->display_name,
            ],
            'preview' => Str::limit($preview ?? '[message]', 160),
            'is_redacted' => $decision->isRedacted(),
            'redaction_reason' => $decision->reason,
            'sent_at' => optional($this->message->sent_at)->toIso8601String(),
        ];
    }

    /**
     * Determine channels for this notification in tests and runtime.
     * We deliberately default to database so tests won't trigger missing channel errors.
     *
     * @param mixed $notifiable
     * @return string[]
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    private function resolvePreviewText(): string
    {
        $preview = $this->message->body;

        if (!$preview) {
            if ($this->message->attachments_count > 0) {
                $preview = '[attachment]';
            } elseif ($this->message->shareable_type) {
                $preview = sprintf('[share:%s]', $this->message->shareable_type);
            } else {
                $preview = '[message]';
            }
        }

        return $preview;
    }
}

