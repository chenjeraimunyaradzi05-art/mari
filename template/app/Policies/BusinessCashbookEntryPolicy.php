<?php

namespace App\Policies;

use App\Models\BusinessCashbookEntry;
use App\Models\User;

final class BusinessCashbookEntryPolicy
{
    public function view(User $user, BusinessCashbookEntry $entry): bool
    {
        return $entry->cashbook && $entry->cashbook->user_id === $user->id;
    }

    public function update(User $user, BusinessCashbookEntry $entry): bool
    {
        return $this->view($user, $entry);
    }

    public function delete(User $user, BusinessCashbookEntry $entry): bool
    {
        return $this->view($user, $entry);
    }
}

