<?php

namespace App\Listeners;

use App\Events\OrgInviteSent;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

final class MarkOrgInviteSent implements ShouldQueue
{
    use InteractsWithQueue;

    public string $queue = 'invites';

    public function handle(\App\Events\OrgInviteSent $event): void
    {
        $invite = $event->invite;

        $meta = $invite->meta ?? [];
        $channel = $invite->channel ?? null;

        if ($channel !== null) {
            $meta['channel_status'] = $meta['channel_status'] ?? [];
            $meta['channel_status'][$channel] = array_merge($meta['channel_status'][$channel] ?? [], [
                'status' => 'sent',
            ]);
        }

        $invite->status = 'sent';
        $invite->sent_at = now();
        $invite->meta = $meta;
        $invite->save();
    }
}

