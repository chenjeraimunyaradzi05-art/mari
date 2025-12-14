<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Models\MortgageIntelligenceAccessLog;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

final class MortgageIntelligenceTelemetry
{
    private const LOOKBACK_DAYS = 7;

    /**
     * @return ((Carbon|array|int|null)[]|Carbon)[]
     *
     * @psalm-return array{since: Carbon, per_listing: array<int, array{total: int<min, max>, last_accessed_at: Carbon|null, channel_breakdown: array<string, int>}>, total: array{count: int, last_accessed_at: Carbon|null, channel_breakdown: array<string, mixed>}}
     */
    public function summariesFor(Collection $listingIds, ?CarbonInterface $since = null): array
    {
        $ids = $listingIds
            ->filter(static fn ($id) => ! empty($id))
            ->unique()
            ->values();

        $windowStart = $since ? Carbon::instance($since) : Carbon::now()->subDays(self::LOOKBACK_DAYS);

        if ($ids->isEmpty()) {
            return [
                'since' => $windowStart,
                'per_listing' => [],
                'total' => [
                    'count' => 0,
                    'last_accessed_at' => null,
                    'channel_breakdown' => [],
                ],
            ];
        }

        $baseQuery = MortgageIntelligenceAccessLog::query()
            ->whereIn('women_housing_listing_id', $ids)
            ->where('accessed_at', '>=', $windowStart);

        $perListing = [];

        MortgageIntelligenceAccessLog::query()
            ->select('women_housing_listing_id', 'channel')
            ->selectRaw('COUNT(*) as aggregate')
            ->whereIn('women_housing_listing_id', $ids)
            ->where('accessed_at', '>=', $windowStart)
            ->groupBy('women_housing_listing_id', 'channel')
            ->get()
            ->each(static function ($row) use (&$perListing): void {
                $listingId = (int) $row->women_housing_listing_id;
                $perListing[$listingId] ??= [
                    'total' => 0,
                    'last_accessed_at' => null,
                    'channel_breakdown' => [],
                ];

                $perListing[$listingId]['channel_breakdown'][$row->channel] = (int) $row->aggregate;
                $perListing[$listingId]['total'] += (int) $row->aggregate;
            });

        $lastAccessPerListing = MortgageIntelligenceAccessLog::query()
            ->select('women_housing_listing_id')
            ->selectRaw('MAX(accessed_at) as last_accessed_at')
            ->whereIn('women_housing_listing_id', $ids)
            ->where('accessed_at', '>=', $windowStart)
            ->groupBy('women_housing_listing_id')
            ->pluck('last_accessed_at', 'women_housing_listing_id');

        foreach ($lastAccessPerListing as $listingId => $timestamp) {
            $listingId = (int) $listingId;
            $perListing[$listingId] ??= [
                'total' => 0,
                'last_accessed_at' => null,
                'channel_breakdown' => [],
            ];
            $perListing[$listingId]['last_accessed_at'] = Carbon::parse($timestamp);
        }

        $totalCount = (clone $baseQuery)->count();
        $totalLastAccess = (clone $baseQuery)->max('accessed_at');
        $totalByChannel = (clone $baseQuery)
            ->select('channel')
            ->selectRaw('COUNT(*) as aggregate')
            ->groupBy('channel')
            ->get()
            ->mapWithKeys(static fn ($row) => [$row->channel => (int) $row->aggregate])
            ->toArray();

        return [
            'since' => $windowStart,
            'per_listing' => $perListing,
            'total' => [
                'count' => (int) $totalCount,
                'last_accessed_at' => $totalLastAccess ? Carbon::parse($totalLastAccess) : null,
                'channel_breakdown' => $totalByChannel,
            ],
        ];
    }
}

