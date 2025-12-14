<?php

namespace App\Support\Analytics\Repositories;

use App\Models\CreatorPayout;
use Illuminate\Support\Collection;

class CreatorPayoutRepository
{
    public function latestForUser(int $userId): ?CreatorPayout
    {
        return CreatorPayout::query()
            ->forUser($userId)
            ->recentFirst()
            ->first();
    }
}

