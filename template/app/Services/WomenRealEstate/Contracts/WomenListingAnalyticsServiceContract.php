<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate\Contracts;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

interface WomenListingAnalyticsServiceContract
{
    /**
     * Calculate metrics for listings. Mirrors the concrete API used in the service.
     *
     * @return array
     */
    public function metrics(array $filters, bool $canModerate, ?User $user, bool $skipCache = false, bool $includeAgentDetails = true): array;

    public function applyFilters(Builder $query, array $filters, bool $canModerate, ?User $user): Builder;

    public function invalidateMetricsCache(): void;
}
