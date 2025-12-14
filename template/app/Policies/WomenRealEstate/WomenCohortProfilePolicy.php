<?php

declare(strict_types=1);

namespace App\Policies\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenCohortProfile;
use Illuminate\Auth\Access\HandlesAuthorization;

final class WomenCohortProfilePolicy
{
    use HandlesAuthorization;

    public function update(User $user, WomenCohortProfile $profile): bool
    {
        return $this->ownsProfile($user, $profile) || $this->canModerate($user);
    }

    private function ownsProfile(User $user, WomenCohortProfile $profile): bool
    {
        return $profile->user_id === $user->id;
    }

    private function canModerate(User $user): bool
    {
        return $user->hasAnyRole(['Super Admin', 'Admin', 'Moderator']);
    }
}

