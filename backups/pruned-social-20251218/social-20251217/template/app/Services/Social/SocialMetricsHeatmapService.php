<?php

namespace App\Services\Social;

use App\Models\SocialMetricsDaily;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

final class SocialMetricsHeatmapService
{
    /**
     * Build aggregated heatmap payload for a target capture date.
     *
     * @return (array|bool|int|string)[]
     *
     * @psalm-return array{date: string, heatmap_range: int, heatmap: array, meta: array{available_ranges: array, applied_cohorts: array<int, mixed>, record_count: int, fallback_reason: 'no_heatmap_data'|'no_records_for_filters'|'thirty_day_unavailable'|null}, fallback: bool}
     */
    public function build(CarbonInterface $date, int $range, Collection $cohortFilters): array
    {
        $targetDate = $date->toDateString();

        $records = SocialMetricsDaily::query()
            ->whereDate('captured_on', $targetDate)
            ->when($cohortFilters->isNotEmpty(), function ($query) use ($cohortFilters) {
                $query->where(function ($builder) use ($cohortFilters) {
                    foreach ($cohortFilters as $cohort) {
                        $builder->orWhere(function ($inner) use ($cohort) {
                            $inner->where('primary_cohort', $cohort)
                                ->orWhereJsonContains('cohort_tags', $cohort);
                        });
                    }
                });
            })
            ->get([
                'id',
                'connection_heatmap_bins',
                'connection_heatmap_bins_30d',
                'cohort_tags',
                'primary_cohort',
            ]);

        $heatmap = $this->aggregateHeatmap($records, $range);
        $availableRanges = $this->determineAvailableRanges($records);

        $fallbackReason = null;
        if ($records->isEmpty()) {
            $fallbackReason = 'no_records_for_filters';
        } elseif (empty($heatmap['daily'])) {
            $fallbackReason = $range === 30
                ? 'thirty_day_unavailable'
                : 'no_heatmap_data';
        }

        return [
            'date' => $targetDate,
            'heatmap_range' => $range,
            'heatmap' => $heatmap,
            'meta' => [
                'available_ranges' => $availableRanges,
                'applied_cohorts' => $cohortFilters->values()->all(),
                'record_count' => $records->count(),
                'fallback_reason' => $fallbackReason,
            ],
            'fallback' => $fallbackReason !== null,
        ];
    }

    /**
     * @return (int|int[])[]
     *
     * @psalm-return array{daily: array<int>, pending: array{incoming: int<min, max>, outgoing: int<min, max>}, max_value: int}
     */
    private function aggregateHeatmap(Collection $records, int $range): array
    {
        $daily = [];
        $pendingIncoming = 0;
        $pendingOutgoing = 0;

        foreach ($records as $record) {
            $bins = $range === 30
                ? $this->extractThirtyDayBins($record)
                : $this->extractSevenDayBins($record);

            foreach ($bins as $bucketDate => $count) {
                $daily[$bucketDate] = ($daily[$bucketDate] ?? 0) + (int) $count;
            }

            $pending = $record->connection_heatmap_bins['pending'] ?? [];
            $pendingIncoming += (int) ($pending['incoming'] ?? 0);
            $pendingOutgoing += (int) ($pending['outgoing'] ?? 0);
        }

        if (! empty($daily)) {
            ksort($daily);
        }

        $pendingSummary = [
            'incoming' => $pendingIncoming,
            'outgoing' => $pendingOutgoing,
        ];

        $maxDaily = empty($daily) ? 0 : max($daily);
        $maxPending = max($pendingSummary['incoming'], $pendingSummary['outgoing']);

        return [
            'daily' => $daily,
            'pending' => $pendingSummary,
            'max_value' => max($maxDaily, $maxPending),
        ];
    }

    private function extractSevenDayBins(SocialMetricsDaily $record): array
    {
        $bins = $record->connection_heatmap_bins ?? [];

        return $bins['daily'] ?? $bins['daily_7'] ?? [];
    }

    private function extractThirtyDayBins(SocialMetricsDaily $record): array
    {
        if (! empty($record->connection_heatmap_bins_30d)) {
            return $record->connection_heatmap_bins_30d;
        }

        $bins = $record->connection_heatmap_bins ?? [];

        return $bins['daily_30'] ?? [];
    }

    /**
     * @return int[]
     *
     * @psalm-return list{0: 7|30, 1?: 7|30,...}
     */
    private function determineAvailableRanges(Collection $records): array
    {
        $available = [];

        if ($records->contains(fn (SocialMetricsDaily $record) => ! empty($this->extractSevenDayBins($record)))) {
            $available[] = 7;
        }

        if ($records->contains(fn (SocialMetricsDaily $record) => ! empty($this->extractThirtyDayBins($record)))) {
            $available[] = 30;
        }

        if (empty($available)) {
            return [7, 30];
        }

        sort($available);

        return $available;
    }
}

