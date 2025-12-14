<?php

namespace App\Events;

use App\Models\OrgInviteLog;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class OrgInviteFailed
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public OrgInviteLog $invite, public ?string $reason = null)
    {
    }
}

