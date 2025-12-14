<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\AgentProfile;
use App\Models\User;

final class AgentProfilePolicy
{


    public function update(User $user, AgentProfile $profile): bool
    {
        return $profile->user_id === $user->id;
    }
}

