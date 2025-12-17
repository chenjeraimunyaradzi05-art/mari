<?php

namespace App\Services\Social;

use App\Models\Connection;
use App\Models\ConnectionActivityLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;

final class ConnectionAnalyticsService
{


    /**
     * @return (array|bool|float|int|mixed|null|string)[]
     *
     * @psalm-return array{allowed: bool, reason: 'burst_limit'|'daily_limit'|null, retry_after: float|mixed|null, remaining_daily: 0|mixed, remaining_window: 0|mixed, limits: array}
     */
    public function enforceRateLimit(User $actor): array
    {
        $limits = $this->limits();
        $now = Carbon::now();

        $dailyKey = $this->cacheKey('daily', $actor->id, $now);
        $burstKey = $this->cacheKey('burst', $actor->id, $now);

        $dailyCount = (int) $this->cache->get($dailyKey, 0);
        $burstCount = (int) $this->cache->get($burstKey, 0);

        if ($dailyCount >= $limits['daily']) {
            return [
                'allowed' => false,
                'reason' => 'daily_limit',
                'retry_after' => $now->copy()->endOfDay()->diffInSeconds($now),
                'remaining_daily' => 0,
                'remaining_window' => max(0, $limits['burst'] - $burstCount),
                'limits' => $limits,
            ];
        }

        if ($burstCount >= $limits['burst']) {
            return [
                'allowed' => false,
                'reason' => 'burst_limit',
                'retry_after' => $limits['burst_minutes'] * 60,
                'remaining_daily' => max(0, $limits['daily'] - $dailyCount),
                'remaining_window' => 0,
                'limits' => $limits,
            ];
        }

        $dailyCount++;
        $burstCount++;

        $this->cache->put($dailyKey, $dailyCount, $now->copy()->endOfDay());
        $this->cache->put($burstKey, $burstCount, $now->copy()->addMinutes($limits['burst_minutes']));

        return [
            'allowed' => true,
            'reason' => null,
            'retry_after' => null,
            'remaining_daily' => max(0, $limits['daily'] - $dailyCount),
            'remaining_window' => max(0, $limits['burst'] - $burstCount),
            'limits' => $limits,
        ];
    }

    public function recordAudit(User $actor, ?User $target, string $action, ?Connection $connection = null, array $context = []): ConnectionActivityLog
    {
        return ConnectionActivityLog::query()->create([
            'actor_id' => $actor->getKey(),
            'target_user_id' => $target?->getKey(),
            'connection_id' => $connection?->getKey(),
            'action' => $action,
            'status' => $connection?->status,
            'context' => empty($context) ? null : $context,
        ]);
    }

    /**
     * @return int[]
     *
     * @psalm-return array<int>
     */
    public function lifecycleBreakdown(User $user): array
    {
        $statuses = array_fill_keys(Connection::allowedStatuses(), 0);

        $counts = Connection::query()
            ->select('status', DB::raw('count(*) as aggregate'))
            ->where(function ($query) use ($user) {
                $query->where('user_id', $user->getKey())
                    ->orWhere('connected_user_id', $user->getKey());
            })
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        foreach ($counts as $status => $count) {
            $statuses[$status] = (int) $count;
        }

        return $statuses;
    }

    /**
     * @return int[]
     *
     * @psalm-return array{daily: int, burst: int, burst_minutes: int}
     */
    private function limits(): array
    {
        return [
            'daily' => (int) config('social.connections.daily_limit', 60),
            'burst' => (int) config('social.connections.burst_limit', 6),
            'burst_minutes' => (int) config('social.connections.burst_minutes', 10),
        ];
    }

    private function cacheKey(string $type, int $userId, Carbon $now): string
    {
        $dateSuffix = $type === 'daily'
            ? $now->format('Y-m-d')
            : $now->format('Y-m-d-H');

        return sprintf('connections:%s:%d:%s', $type, $userId, $dateSuffix);
    }
}

