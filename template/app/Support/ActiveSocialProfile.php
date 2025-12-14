<?php

namespace App\Support;

use App\Models\Profile;
use App\Models\SocialProfile;
use App\Models\User;
use App\Services\Social\SocialProfileProvisioner;

final class ActiveSocialProfile
{
    public static function forUser(?User $user, bool $provisionIfMissing = true): ?SocialProfile
    {
        $profile = ActiveProfile::forUser($user);

        if (!$profile) {
            return null;
        }

        return self::forProfile($profile, $provisionIfMissing);
    }

    public static function forProfile(?Profile $profile, bool $provisionIfMissing = true): ?SocialProfile
    {
        if (!$profile) {
            return null;
        }

        if ($profile->relationLoaded('personaSocialProfile') && $profile->personaSocialProfile) {
            return $profile->personaSocialProfile;
        }

        if ($profile->social_profile_id) {
            return $profile->personaSocialProfile()->first();
        }

        if (!$provisionIfMissing) {
            return null;
        }

        $provisioner = app(SocialProfileProvisioner::class);

        return $provisioner->provisionForProfile($profile);
    }
}

