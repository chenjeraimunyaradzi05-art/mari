<?php

namespace App\Support\Analytics\Repositories;

use App\Models\CareerIntelligenceSnapshot;
use Illuminate\Support\Collection;

class CareerIntelligenceRepository
{
    public function latestForUser(int $userId): ?CareerIntelligenceSnapshot
    {
        return CareerIntelligenceSnapshot::query()
            ->forUser($userId)
            ->latestSnapshot()
            ->first();
    }

    public function historyForUser(int $userId, int $limit = 10): Collection
    {
        return CareerIntelligenceSnapshot::query()
            ->forUser($userId)
            ->latestSnapshot()
            ->limit($limit)
            ->get();
    }
}

