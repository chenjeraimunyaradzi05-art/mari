<?php

namespace App\Events;

use App\Models\SocialPost;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

final class PostCreated implements ShouldBroadcast
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    /**
     * @param  array<int, int>  $followerIds
     */
    public function __construct(public SocialPost $post, public array $followerIds)
    {
    }

    /**
     * @return PrivateChannel[]
     *
     * @psalm-return array<int, PrivateChannel>
     */
    #[\Override]
    public function broadcastOn(): array
    {
        return collect($this->followerIds)
            ->filter()
            ->unique()
            ->map(fn (int $userId) => new PrivateChannel('social.user.' . $userId))
            ->values()
            ->all();
    }
}

