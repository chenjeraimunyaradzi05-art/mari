<?php

namespace App\Policies;

use App\Models\SocialProfile;
use App\Models\User;

final class SocialProfilePolicy
{


    public function update(User $user, SocialProfile $profile): bool
    {
        return $profile->isOwnedByUser($user);
    }
}

