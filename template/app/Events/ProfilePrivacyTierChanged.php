<?php

namespace App\Events;

use App\Models\Profile;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class ProfilePrivacyTierChanged
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public Profile $profile,
        public ?User $actor,
        public string $fromTier,
        public string $toTier,
        public array $metadata = []
    ) {
    }
}

