<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\GrantApplication;
use App\Models\User;

final class GrantApplicationPolicy
{
    public function update(User $user, GrantApplication $application): bool
    {
        return $application->user_id === $user->id;
    }
}

