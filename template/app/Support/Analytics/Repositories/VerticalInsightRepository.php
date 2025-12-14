<?php

namespace App\Support\Analytics\Repositories;

use App\Models\VerticalInsight;
use Illuminate\Support\Collection;

final class VerticalInsightRepository
{
    public function allOrdered(): Collection
    {
        return VerticalInsight::query()
            ->ordered()
            ->get();
    }

    public function findBySlug(string $slug): ?VerticalInsight
    {
        return VerticalInsight::query()
            ->where('vertical_slug', $slug)
            ->first();
    }
}

