<?php

namespace App\Services\Privacy;

use App\Models\Profile;
use App\Models\ProfilePrivacyAudit;
use App\Models\User;

final class ProfilePrivacyAuditLogger
{
    public function log(
        Profile $profile,
        ?User $actor,
        string $fromTier,
        string $toTier,
        string $reason,
        array $metadata = []
    ): void {
        if ($fromTier === $toTier) {
            return;
        }

        ProfilePrivacyAudit::create([
            'profile_id' => $profile->getKey(),
            'actor_user_id' => $actor?->getKey(),
            'from_tier' => $fromTier,
            'to_tier' => $toTier,
            'reason' => $reason,
            'metadata' => empty($metadata) ? null : $metadata,
        ]);
    }
}

