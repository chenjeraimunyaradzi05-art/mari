<?php

namespace App\Support\Analytics;

use Illuminate\Support\Facades\Cache;

final class DashboardCache
{
    public static function flushPulse(int $userId): void
    {
        Cache::forget(self::key('pulse', $userId));
        Cache::forget(self::key('pulse_history', $userId));
        Cache::forget(self::key('payout', $userId));
    }

    public static function flushStreams(int $userId): void
    {
        Cache::forget(self::key('streams', $userId));
    }

    public static function flushPersonas(int $userId): void
    {
        Cache::forget(self::key('personas', $userId));
    }

    public static function flushAll(int $userId): void
    {
        self::flushPulse($userId);
        self::flushStreams($userId);
        self::flushPersonas($userId);
    }

    public static function key(string $segment, int $userId): string
    {
        return sprintf('dashboard:%s:user:%d', $segment, $userId);
    }
}

