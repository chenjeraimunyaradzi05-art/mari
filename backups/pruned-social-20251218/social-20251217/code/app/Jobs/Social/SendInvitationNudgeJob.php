<?php

namespace App\Jobs\Social;

use App\Models\Invitation;
use App\Models\Notification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class SendInvitationNudgeJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        private readonly int $invitationId,
        private readonly ?string $templateKey = null,
        private readonly ?int $offsetHours = null
    ) {
    }
}

