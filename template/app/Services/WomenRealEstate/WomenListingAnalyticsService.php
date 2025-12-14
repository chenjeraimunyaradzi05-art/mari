<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Services\WomenRealEstate\Contracts\WomenListingAnalyticsServiceContract;

use App\Models\User;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class WomenListingAnalyticsService implements WomenListingAnalyticsServiceContract
{
    private const DEFAULT_CACHE_TTL = 60;
    private const CACHE_INDEX_KEY = 'women_listing_metrics:index';

    /**
     * @return ((bool|int|null|string)[]|mixed)[]
     *
     * @psalm-return array{_cache: array{hit: bool, refreshed: bool, cached_at: null|string, expires_at: null|string, ttl: int|null, key: null|string, duration_ms: int|null},...}
     */
    public function metrics(
        array $filters,
        bool $canModerate,
        ?User $user,
        bool $skipCache = false,
        bool $includeAgentDetails = true
    ): array {
        $ttl = $this->resolveCacheTtl();
        $shouldCache = $ttl > 0;
        $cacheTtl = $shouldCache ? $ttl : null;

        $queryFilters = $this->sanitiseFiltersForCache($filters);
    $cacheKey = $this->metricsCacheKey($queryFilters, $canModerate, $user, $includeAgentDetails);

        if ($shouldCache && ! $skipCache) {
            $cached = Cache::get($cacheKey);

            if (is_array($cached) && array_key_exists('data', $cached)) {
                $matchesDetailPreference = ! isset($cached['include_agent_details'])
                    || $cached['include_agent_details'] === $includeAgentDetails;

                if ($matchesDetailPreference) {
                    $this->storeCacheKey($cacheKey);

                    $cachedAt = $this->parseCacheTimestamp($cached['cached_at'] ?? null);
                    $cachedTtl = isset($cached['ttl']) ? (int) $cached['ttl'] : $cacheTtl;

                    return $this->appendCacheMeta(
                        $cached['data'],
                        true,
                        $cachedAt,
                        $cachedTtl,
                        false,
                        $cacheKey,
                        isset($cached['duration_ms']) ? (int) $cached['duration_ms'] : null
                    );
                }
            }
        }

        $startedAt = microtime(true);
        $metrics = $this->calculateMetrics($queryFilters, $canModerate, $user, $includeAgentDetails);
        $durationMs = (int) round((microtime(true) - $startedAt) * 1000);

        $cachedAt = null;

        if ($shouldCache) {
            $payload = $this->buildCachePayload($metrics, $ttl, $includeAgentDetails, $durationMs);
            Cache::put($cacheKey, $payload, $ttl);
            $this->storeCacheKey($cacheKey);

            $cachedAt = $this->parseCacheTimestamp($payload['cached_at']);
        }

        return $this->appendCacheMeta(
            $metrics,
            false,
            $cachedAt,
            $cacheTtl,
            $skipCache,
            $shouldCache ? $cacheKey : null,
            $durationMs
        );
    }

    public function applyFilters(Builder $query, array $filters, bool $canModerate, ?User $user): Builder
    {
        if (! $canModerate && $user !== null) {
            $query->where('owner_id', $user->id);
        }

        if (isset($filters['owner_id'])) {
            $requestedOwnerId = (int) $filters['owner_id'];

            if ($canModerate || ($user !== null && $requestedOwnerId === $user->id)) {
                $query->where('owner_id', $requestedOwnerId);
            }
        }

        if (isset($filters['agent_id'])) {
            $query->where('agent_id', $filters['agent_id']);
        }

        if (isset($filters['intent'])) {
            $query->where('intent', $filters['intent']);
        }

        if (isset($filters['primary_audience'])) {
            $query->where('primary_audience', $filters['primary_audience']);
        }

        if (! empty($filters['audience']) || ! empty($filters['audiences'])) {
            $audiences = Arr::wrap($filters['audience'] ?? $filters['audiences']);
            $audiences = array_filter($audiences, static fn ($value) => $value !== null && $value !== '');

            if ($audiences !== []) {
                $query->forAudience($audiences);
            }
        }

        if (array_key_exists('published', $filters)) {
            $isPublished = (bool) $filters['published'];
            $isPublished
                ? $query->whereNotNull('published_at')
                : $query->whereNull('published_at');
        }

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);

            if ($search !== '') {
                $query->where(function (Builder $builder) use ($search): void {
                    $builder
                        ->where('title', 'like', '%' . $search . '%')
                        ->orWhere('summary', 'like', '%' . $search . '%')
                        ->orWhere('description', 'like', '%' . $search . '%');
                });
            }
        }

        if (! empty($filters['created_from'])) {
            $query->where('created_at', '>=', Carbon::parse($filters['created_from'])->startOfDay());
        }

        if (! empty($filters['created_to'])) {
            $query->where('created_at', '<=', Carbon::parse($filters['created_to'])->endOfDay());
        }

        if (! empty($filters['published_from'])) {
            $query->where('published_at', '>=', Carbon::parse($filters['published_from'])->startOfDay());
        }

        if (! empty($filters['published_to'])) {
            $query->where('published_at', '<=', Carbon::parse($filters['published_to'])->endOfDay());
        }

        return $query;
    }

    /**
     * @return (((array|int|null|string)[]|int|null)[][]|int)[]
     *
     * @psalm-return array{total: int, published: int, draft: int, verified: int, unverified: int, by_intent: array<string, array{total: int, published: int, draft: int, verified: int, unverified: int}>, by_primary_audience: array<string, array{total: int, published: int, draft: int, verified: int, unverified: int}>, by_agent: array<numeric-string, array{agent: array{id: int, user_id: int, status: string, verified_at: null|string, user: array|null}|null, total: int, published: int, draft: int, verified: int, unverified: int}>}
     */
    private function calculateMetrics(array $filters, bool $canModerate, ?User $user, bool $includeAgentDetails): array
    {
        $query = WomenListing::query();
        $this->applyFilters($query, $filters, $canModerate, $user);

        $baseQuery = clone $query;
        $total = (clone $baseQuery)->count();
        $published = (clone $baseQuery)->whereNotNull('published_at')->count();
        $verified = (clone $baseQuery)->where('is_verified', true)->count();

        $draft = $total - $published;
        $unverified = $total - $verified;

        return [
            'total' => $total,
            'published' => $published,
            'draft' => $draft,
            'verified' => $verified,
            'unverified' => $unverified,
            'by_intent' => $this->groupedMetrics(clone $baseQuery, 'intent'),
            'by_primary_audience' => $this->groupedMetrics(clone $baseQuery, 'primary_audience'),
            'by_agent' => $this->agentMetrics(clone $baseQuery, $includeAgentDetails),
        ];
    }

    /**
     * @return int[][]
     *
     * @psalm-return array<string, array{total: int, published: int, draft: int, verified: int, unverified: int}>
     */
    private function groupedMetrics(Builder $query, string $column): array
    {
        return $query
            ->selectRaw(sprintf('%s, COUNT(*) as total_count, SUM(CASE WHEN published_at IS NOT NULL THEN 1 ELSE 0 END) as published_count, SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verified_count', $column))
            ->groupBy($column)
            ->get()
            ->sortByDesc(static fn ($row) => (int) ($row->total_count ?? 0))
            ->values()
            ->mapWithKeys(/**
             * @return int[][]
             *
             * @psalm-return array<string, array{total: int, published: int, draft: int, verified: int, unverified: int}>
             */
            function ($row) use ($column): array {
                $key = $this->normalizeMetricKey($row->{$column} ?? null);

                if ($key === null) {
                    return [];
                }

                $totalCount = (int) ($row->total_count ?? 0);
                $publishedCount = (int) ($row->published_count ?? 0);
                $verifiedCount = (int) ($row->verified_count ?? 0);

                return [
                    $key => [
                        'total' => $totalCount,
                        'published' => $publishedCount,
                        'draft' => $totalCount - $publishedCount,
                        'verified' => $verifiedCount,
                        'unverified' => $totalCount - $verifiedCount,
                    ],
                ];
            })
            ->all();
    }

    /**
     * @return ((array|int|null|string)[]|int|null)[][]
     *
     * @psalm-return array<numeric-string, array{agent: array{id: int, user_id: int, status: string, verified_at: null|string, user: array|null}|null, total: int, published: int, draft: int, verified: int, unverified: int}>
     */
    private function agentMetrics(Builder $query, bool $includeAgentDetails): array
    {
        /**
         * @var Collection<int, array{
         *     agent_id:int|null,
         *     total_count:int,
         *     published_count:int,
         *     verified_count:int
         * }> $rows
         */
        $rows = $query
            ->selectRaw('agent_id, COUNT(*) as total_count, SUM(CASE WHEN published_at IS NOT NULL THEN 1 ELSE 0 END) as published_count, SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verified_count')
            ->groupBy('agent_id')
            ->get()
            ->map(/**
             * @return (int|null)[]
             *
             * @psalm-return array{agent_id: int|null, total_count: int, published_count: int, verified_count: int}
             */
            static function ($row): array {
                return [
                    'agent_id' => $row->agent_id !== null ? (int) $row->agent_id : null,
                    'total_count' => (int) ($row->total_count ?? 0),
                    'published_count' => (int) ($row->published_count ?? 0),
                    'verified_count' => (int) ($row->verified_count ?? 0),
                ];
            });

        $sortedRows = $rows
            ->sortByDesc(static fn (array $row) => $row['total_count'])
            ->values();

        $agentIds = $sortedRows
            ->pluck('agent_id')
            ->filter()
            ->unique()
            ->values();

        $agents = (! $includeAgentDetails || $agentIds->isEmpty())
            ? collect()
            : WomenVerifiedAgent::query()
                ->with(['user:id,name,email'])
                ->whereIn('id', $agentIds)
                ->get()
                ->keyBy('id');

        return $sortedRows->mapWithKeys(/**
         * @return ((array|int|null|string)[]|int|null)[][]
         *
         * @psalm-return array<numeric-string, array{agent: array{id: int, user_id: int, status: string, verified_at: null|string, user: array|null}|null, total: int, published: int, draft: int, verified: int, unverified: int}>
         */
        /**
         * @return ((array|int|null|string)[]|int|null)[][]
         *
         * @psalm-return array<numeric-string, array{agent: array{id: int, user_id: int, status: string, verified_at: null|string, user: array|null}|null, total: int, published: int, draft: int, verified: int, unverified: int}>
         */
        /**
         * @return ((array|int|null|string)[]|int|null)[][]
         *
         * @psalm-return array<numeric-string, array{agent: array{id: int, user_id: int, status: string, verified_at: null|string, user: array|null}|null, total: int, published: int, draft: int, verified: int, unverified: int}>
         */
        function (array $row) use ($agents, $includeAgentDetails): array {
            $agentId = $row['agent_id'] ?? null;
            $key = $agentId !== null ? (string) $agentId : 'unassigned';
            $totalCount = (int) ($row['total_count'] ?? 0);
            $publishedCount = (int) ($row['published_count'] ?? 0);
            $verifiedCount = (int) ($row['verified_count'] ?? 0);

            $agentPayload = null;

            if ($includeAgentDetails && $agentId !== null && $agents->has($agentId)) {
                /** @var WomenVerifiedAgent $agent */
                $agent = $agents->get($agentId);

                $userData = null;
                if ($agent->relationLoaded('user') && $agent->user !== null) {
                    $userData = $agent->user->only(['id', 'name', 'email']);
                }

                $agentPayload = [
                    'id' => $agent->id,
                    'user_id' => $agent->user_id,
                    'status' => $agent->status,
                    'verified_at' => optional($agent->verified_at)->toISOString(),
                    'user' => $userData,
                ];
            }

            return [
                $key => [
                    'agent' => $agentPayload,
                    'total' => $totalCount,
                    'published' => $publishedCount,
                    'draft' => $totalCount - $publishedCount,
                    'verified' => $verifiedCount,
                    'unverified' => $totalCount - $verifiedCount,
                ],
            ];
        })->all();
    }

    private function resolveCacheTtl(): int
    {
        return (int) config('women_real_estate.metrics_cache_ttl', self::DEFAULT_CACHE_TTL);
    }

    private function normalizeMetricKey(mixed $value): ?string
    {
        if ($value instanceof \BackedEnum) {
            return (string) $value->value;
        }

        if ($value === null || $value === '') {
            return null;
        }

        return (string) $value;
    }

    private function metricsCacheKey(array $filters, bool $canModerate, ?User $user, bool $includeAgentDetails): string
    {
        $normalizedFilters = $this->normalizeFiltersRecursively($filters);

        return sprintf(
            'women_listing_metrics:%s:%s:%s:%s:%s',
            app()->environment(),
            $canModerate ? 'moderator' : 'owner',
            $user?->id ?? 'user-null',
            md5(json_encode($normalizedFilters, JSON_THROW_ON_ERROR)),
            $includeAgentDetails ? 'details-full' : 'details-lite'
        );
    }

    private function normalizeFiltersRecursively(array $filters): array
    {
        ksort($filters);

        foreach ($filters as $key => $value) {
            if (is_array($value)) {
                $filters[$key] = $this->normalizeFiltersRecursively($value);
            }
        }

        return $filters;
    }

    private function sanitiseFiltersForCache(array $filters): array
    {
        unset($filters['per_page'], $filters['refresh_cache'], $filters['include_agent_details']);

        if (array_key_exists('published', $filters)) {
            $filters['published'] = (bool) $filters['published'];
        }

        if (! empty($filters['search'])) {
            $filters['search'] = trim((string) $filters['search']);
        }

        return $filters;
    }

    public function invalidateMetricsCache(): void
    {
        $keys = Cache::get(self::CACHE_INDEX_KEY, []);

        if (is_array($keys) && $keys !== []) {
            foreach ($keys as $key) {
                if (is_string($key)) {
                    Cache::forget($key);
                }
            }
        }

        Cache::forget(self::CACHE_INDEX_KEY);
    }

    private function storeCacheKey(string $cacheKey): void
    {
        $keys = Cache::get(self::CACHE_INDEX_KEY, []);

        if (! is_array($keys)) {
            $keys = [];
        }

        if (! in_array($cacheKey, $keys, true)) {
            $keys[] = $cacheKey;
            Cache::forever(self::CACHE_INDEX_KEY, $keys);
        }
    }

    /**
     * @return (array|bool|int|string)[]
     *
     * @psalm-return array{data: array, cached_at: string, ttl: int, include_agent_details: bool, duration_ms: int}
     */
    private function buildCachePayload(array $metrics, int $ttl, bool $includeAgentDetails, int $durationMs): array
    {
        return [
            'data' => $metrics,
            'cached_at' => Carbon::now()->toIso8601String(),
            'ttl' => $ttl,
            'include_agent_details' => $includeAgentDetails,
            'duration_ms' => $durationMs,
        ];
    }

    /**
     * @return ((bool|int|null|string)[]|mixed)[]
     *
     * @psalm-return array{_cache: array{hit: bool, refreshed: bool, cached_at: null|string, expires_at: null|string, ttl: int|null, key: null|string, duration_ms: int|null},...}
     */
    private function appendCacheMeta(
        array $metrics,
        bool $hit,
        ?Carbon $cachedAt,
        ?int $ttl,
        bool $refreshed,
        ?string $cacheKey,
        ?int $durationMs
    ): array
    {
        $expiresAt = null;

        if ($cachedAt !== null && $ttl !== null && $ttl > 0) {
            $expiresAt = (clone $cachedAt)->addSeconds($ttl);
        }

        $metrics['_cache'] = [
            'hit' => $hit,
            'refreshed' => $refreshed,
            'cached_at' => $cachedAt?->toISOString(),
            'expires_at' => $expiresAt?->toISOString(),
            'ttl' => $ttl,
            'key' => $cacheKey,
            'duration_ms' => $durationMs,
        ];

        return $metrics;
    }

    private function parseCacheTimestamp(?string $timestamp): ?Carbon
    {
        if ($timestamp === null || $timestamp === '') {
            return null;
        }

        try {
            return Carbon::parse($timestamp);
        } catch (\Throwable) {
            return null;
        }
    }
}

