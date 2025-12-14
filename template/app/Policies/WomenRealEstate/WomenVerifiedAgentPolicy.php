<?php

declare(strict_types=1);

namespace App\Policies\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Illuminate\Auth\Access\HandlesAuthorization;

final class WomenVerifiedAgentPolicy
{
    use HandlesAuthorization;

    private function ownsAgent(User $user, WomenVerifiedAgent $agent): bool
    {
        return $agent->user_id === $user->id;
    }

    private function canModerate(User $user): bool
    {
        return $user->hasAnyRole(['Super Admin', 'Admin', 'Moderator']);
    }
}

