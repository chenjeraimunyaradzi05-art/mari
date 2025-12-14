<?php

namespace App\Events;

use App\Models\SocialMessage;
use App\Models\SocialThread;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;
use App\Services\Messaging\MessagingPreviewPrivacyGuard;
use Illuminate\Support\Str;

final class ConversationMessageCreated implements ShouldBroadcast
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public SocialThread $thread,
        public SocialMessage $message,
        public User $recipient
    ) {
        $this->message->loadMissing(['sender', 'attachments']);
    }

    /**
     * @return PrivateChannel[]
     *
     * @psalm-return list{PrivateChannel}
     */
    #[\Override]
    public function broadcastOn(): array
    {
        return [new PrivateChannel('social.user.' . $this->recipient->getKey())];
    }
}

