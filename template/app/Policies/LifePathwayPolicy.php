<?php

namespace App\Policies;

use App\Models\Pathways\LifePathway;
use App\Models\User;

final class LifePathwayPolicy
{
    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, LifePathway $lifePathway): bool
    {
        return $user->id === $lifePathway->user_id;
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, LifePathway $lifePathway): bool
    {
        return $user->id === $lifePathway->user_id;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, LifePathway $lifePathway): bool
    {
        return $user->id === $lifePathway->user_id;
    }
}

