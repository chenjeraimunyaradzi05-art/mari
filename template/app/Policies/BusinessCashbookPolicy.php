<?php

namespace App\Policies;

use App\Models\BusinessCashbook;
use App\Models\User;

final class BusinessCashbookPolicy
{
    public function view(User $user, BusinessCashbook $cashbook): bool
    {
        return $cashbook->user_id === $user->id;
    }

    public function update(User $user, BusinessCashbook $cashbook): bool
    {
        return $this->view($user, $cashbook);
    }

    public function manageEntries(User $user, BusinessCashbook $cashbook): bool
    {
        return $this->view($user, $cashbook);
    }
}

