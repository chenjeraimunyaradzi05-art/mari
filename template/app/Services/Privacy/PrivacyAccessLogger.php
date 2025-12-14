<?php

namespace App\Services\Privacy;

use App\Models\PrivacyAccessLog;
use App\Models\Profile;
use App\Models\SocialProfile;
use App\Models\User;

final class PrivacyAccessLogger
{
    public function log(
        ?User $user,
        ?Profile $profile,
        ?SocialProfile $socialProfile,
        string $channel,
        string $privacyTier,
        array $requested,
        array $granted,
        array $denied,
        ?string $decision = null,
        array $metadata = []
    ): void {
        PrivacyAccessLog::create([
            'user_id' => $user?->getKey(),
            'profile_id' => $profile?->getKey(),
            'social_profile_id' => $socialProfile?->getKey(),
            'channel' => $channel,
            'privacy_tier' => $privacyTier,
            'requested_fields' => empty($requested) ? null : array_values($requested),
            'granted_fields' => empty($granted) ? null : array_values($granted),
            'denied_fields' => empty($denied) ? null : array_values($denied),
            'decision' => $decision,
            'metadata' => empty($metadata) ? null : $metadata,
            'checked_at' => now(),
        ]);
    }
}

