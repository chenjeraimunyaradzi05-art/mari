<?php

declare(strict_types=1);

namespace App\Policies\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenCohortEnrolment;
use Illuminate\Auth\Access\HandlesAuthorization;

final class WomenCohortEnrolmentPolicy
{
    use HandlesAuthorization;

    public function update(User $user, WomenCohortEnrolment $enrolment): bool
    {
        return $this->ownsEnrolment($user, $enrolment) || $this->canModerate($user);
    }

    private function ownsEnrolment(User $user, WomenCohortEnrolment $enrolment): bool
    {
        return $enrolment->profile?->user_id === $user->id;
    }

    private function canModerate(User $user): bool
    {
        return $user->hasAnyRole(['Super Admin', 'Admin', 'Moderator']);
    }
}

