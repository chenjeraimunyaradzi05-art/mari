<?php

namespace App\Support;

use App\Models\OrganizationPage;
use App\Models\User;
use Illuminate\Support\Collection;

final class OrgPageAccess
{
    public static function idsFor(User $user): Collection
    {
        return OrganizationPage::query()
            ->where(function ($query) use ($user) {
                $query->whereHas('company', fn ($companyQuery) => $companyQuery->where('user_id', $user->id))
                    ->orWhereHas('admins', fn ($adminQuery) => $adminQuery->where('user_id', $user->id));
            })
            ->pluck('id');
    }
}

