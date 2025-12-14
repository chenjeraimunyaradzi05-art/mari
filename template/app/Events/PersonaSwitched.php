<?php

namespace App\Events;

use App\Models\Profile;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class PersonaSwitched implements ShouldBroadcast
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly Profile $profile,
        public readonly ?string $context = null,
    ) {
    }

    #[\Override]
    /**
     * @return PrivateChannel[]
     *
     * @psalm-return list{PrivateChannel}
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('users.'.$this->user->getKey().'.personas')];
    }
}

