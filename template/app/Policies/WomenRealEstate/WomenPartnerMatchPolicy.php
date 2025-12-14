<?php

declare(strict_types=1);

namespace App\Policies\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenPartnerMatch;
use Illuminate\Auth\Access\HandlesAuthorization;

final class WomenPartnerMatchPolicy
{
    use HandlesAuthorization;

    public function update(User $user, WomenPartnerMatch $match): bool
    {
        if ($this->canModerate($user)) {
            return true;
        }

        return $this->ownsMatch($user, $match);
    }

    private function ownsMatch(User $user, WomenPartnerMatch $match): bool
    {
        $profile = $match->profile;

        return $profile !== null && $profile->user_id === $user->id;
    }

    private function canModerate(User $user): bool
    {
        return $user->hasAnyRole(['Super Admin', 'Admin', 'Moderator']);
    }
}

