<?php

namespace App\Notifications\Messaging;

use App\Models\SocialProfile;
use App\Models\SocialThread;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

final class MessageRequestNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly SocialThread $thread,
        private readonly SocialProfile $initiator,
        private readonly SocialProfile $target
    ) {
        $this->onConnection(config('social_messaging.queue.connection', config('queue.default')));
        $this->onQueue(config('social_messaging.queue.name', 'notifications'));
    }

    /**
     * @return ((mixed|string)[]|mixed|null|string)[]
     *
     * @psalm-return array{type: 'message_request', thread_id: mixed, subject: null|string, initiator: array{id: mixed, username: string, display_name: string}, target_profile_id: mixed, target_username: string, created_at: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'message_request',
            'thread_id' => $this->thread->getKey(),
            'subject' => $this->thread->subject,
            'initiator' => [
                'id' => $this->initiator->getKey(),
                'username' => $this->initiator->username,
                'display_name' => $this->initiator->display_name,
            ],
            'target_profile_id' => $this->target->getKey(),
            'target_username' => $this->target->username,
            'created_at' => optional($this->thread->created_at)->toIso8601String(),
        ];
    }
}

