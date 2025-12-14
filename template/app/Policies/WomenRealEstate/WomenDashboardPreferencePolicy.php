<?php

declare(strict_types=1);

namespace App\Policies\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenDashboardPreference;
use Illuminate\Auth\Access\HandlesAuthorization;

final class WomenDashboardPreferencePolicy
{
    use HandlesAuthorization;

    public function update(User $user, WomenDashboardPreference $preference): bool
    {
        return $this->ownsPreference($user, $preference) || $this->canModerate($user);
    }

    private function ownsPreference(User $user, WomenDashboardPreference $preference): bool
    {
        return $preference->user_id === $user->id;
    }

    private function canModerate(User $user): bool
    {
        return $user->hasAnyRole(['Super Admin', 'Admin', 'Moderator']);
    }
}

