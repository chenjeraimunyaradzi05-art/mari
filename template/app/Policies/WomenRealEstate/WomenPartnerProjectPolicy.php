<?php

declare(strict_types=1);

namespace App\Policies\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenPartnerProject;
use Illuminate\Auth\Access\HandlesAuthorization;

final class WomenPartnerProjectPolicy
{
    use HandlesAuthorization;

    public function update(User $user, WomenPartnerProject $project): bool
    {
        return $this->ownsProject($user, $project) || $this->canModerate($user);
    }

    private function ownsProject(User $user, WomenPartnerProject $project): bool
    {
        return $project->owner_id === $user->id;
    }

    private function canModerate(User $user): bool
    {
        return $user->hasAnyRole(['Super Admin', 'Admin', 'Moderator']);
    }
}

