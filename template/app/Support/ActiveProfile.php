<?php

namespace App\Support;

use App\Models\Profile;
use App\Models\User;

final class ActiveProfile
{
    public static function forUser(?User $user): ?Profile
    {
        if (!$user) {
            return null;
        }

        if ($user->relationLoaded('activeProfile') && $user->activeProfile) {
            return $user->activeProfile;
        }

        if ($user->active_profile_id) {
            return $user->activeProfile()->first();
        }

        $activeProfile = $user->profiles()
            ->where('is_active', true)
            ->orderByDesc('is_primary')
            ->orderBy('id')
            ->first();

        if ($activeProfile) {
            return $activeProfile;
        }

        return $user->profiles()->orderByDesc('is_primary')->orderBy('id')->first();
    }
}

