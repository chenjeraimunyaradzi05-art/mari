<?php

namespace App\Listeners;

use App\Events\OrgInviteFailed;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

final class MarkOrgInviteFailed implements ShouldQueue
{
    use InteractsWithQueue;

    public string $queue = 'invites';

    public function handle(OrgInviteFailed $event): void
    {
        $invite = $event->invite;
        $reason = $event->reason ?? 'failed';

        $meta = $invite->meta ?? [];
        $channel = $invite->channel ?? null;

        // ensure meta structure exists
        $meta['error'] = $reason;

        if ($channel !== null) {
            $meta['channel_status'] = $meta['channel_status'] ?? [];
            $meta['channel_status'][$channel] = array_merge($meta['channel_status'][$channel] ?? [], [
                'status' => 'failed',
                'notes' => $reason,
            ]);
        }

        $invite->status = 'failed';
        $invite->meta = $meta;
        $invite->save();
    }
}

