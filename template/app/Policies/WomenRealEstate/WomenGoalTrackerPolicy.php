<?php

declare(strict_types=1);

namespace App\Policies\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenGoalTracker;
use Illuminate\Auth\Access\HandlesAuthorization;

final class WomenGoalTrackerPolicy
{
    use HandlesAuthorization;

    public function update(User $user, WomenGoalTracker $tracker): bool
    {
        return $this->ownsTracker($user, $tracker) || $this->canModerate($user);
    }

    private function ownsTracker(User $user, WomenGoalTracker $tracker): bool
    {
        return $tracker->profile?->user_id === $user->id;
    }

    private function canModerate(User $user): bool
    {
        return $user->hasAnyRole(['Super Admin', 'Admin', 'Moderator']);
    }
}

