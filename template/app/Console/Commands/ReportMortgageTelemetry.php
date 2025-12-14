<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\MortgageIntelligenceAccessLog;
use App\Services\RealTimeAnalyticsEngine;
use App\Services\WomenRealEstate\MortgageIntelligenceTelemetry;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

final class ReportMortgageTelemetry extends Command
{
    protected $signature = 'women:mortgage-telemetry:report {--hours=24 : Time window to report in hours}';

    protected $description = 'Summarise mortgage intelligence widget activity for operational visibility.';

    public function handle(MortgageIntelligenceTelemetry $telemetry, RealTimeAnalyticsEngine $analytics): int
    {
        $hours = max(1, (int) $this->option('hours'));
        $since = Carbon::now()->subHours($hours);

        $listingIds = MortgageIntelligenceAccessLog::query()
            ->where('accessed_at', '>=', $since)
            ->distinct()
            ->pluck('women_housing_listing_id');

        $summary = $telemetry->summariesFor($listingIds, $since);

        $payload = [
            'window_hours' => $hours,
            'window_started_at' => $since->toIso8601String(),
            'total' => [
                'count' => $summary['total']['count'] ?? 0,
                'last_accessed_at' => $summary['total']['last_accessed_at']?->toIso8601String(),
                'channel_breakdown' => $summary['total']['channel_breakdown'] ?? [],
            ],
            'listings' => collect($summary['per_listing'] ?? [])
                ->map(fn ($data, $listingId) => [
                    'listing_id' => (int) $listingId,
                    'total' => $data['total'] ?? 0,
                    'last_accessed_at' => ($data['last_accessed_at'] ?? null)?->toIso8601String(),
                    'channel_breakdown' => $data['channel_breakdown'] ?? [],
                ])
                ->values()
                ->all(),
        ];

        Log::channel('daily')->info('[MortgageTelemetryReport]', $payload);

        $analytics->record('mortgage_widget_usage_summary', [
            'source' => 'women_real_estate',
            'properties' => [
                'window_hours' => $payload['window_hours'],
                'total_refreshes' => $payload['total']['count'],
                'listing_count' => count($payload['listings']),
            ],
            'metadata' => [
                'window_started_at' => $payload['window_started_at'],
                'channel_breakdown' => $payload['total']['channel_breakdown'],
                'listings' => $payload['listings'],
            ],
        ]);

        $this->table(
            ['Listing', 'Refreshes', 'Last Refresh', 'Channels'],
            collect($payload['listings'])->map(static fn ($row) => [
                $row['listing_id'],
                $row['total'],
                $row['last_accessed_at'] ? Carbon::parse($row['last_accessed_at'])->diffForHumans() : '—',
                collect($row['channel_breakdown'])->map(fn ($count, $channel) => sprintf('%s:%d', $channel, $count))->implode(', ') ?: '—',
            ])->all()
        );

        $this->info(sprintf(
            'Window: last %d hours · Total refreshes: %d',
            $payload['window_hours'],
            $payload['total']['count']
        ));

        return self::SUCCESS;
    }
}

