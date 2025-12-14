<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class AIMetricsUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $metrics;

    /**
     * Create a new event instance.
     */
    public function __construct(array $metrics)
    {
        $this->metrics = $metrics;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return Channel[]
     *
     * @psalm-return list{Channel}
     */
    #[\Override]
    public function broadcastOn(): array
    {
        return [
            new Channel('ai-metrics'),
        ];
    }
}

