<?php

namespace App\Services\Advertising;

use App\Models\AdvertisingSlot;
use App\Models\AdvertisingSlotRevenueSnapshot;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class SlotRevenueInsightsService
{
    /**
     * @return (array|float|int)[]
     *
     * @psalm-return array{window: array, totals: array{impressions: int<min, max>, clicks: int<min, max>, conversions: int, qualified_leads: int<min, max>, spend_cents: int, pipeline_value: float, partner_touchpoints: int, ctr: float, cpm: float, cpc: float, cpl: float, spend: float}, avg_partner_density: 0|float}
     */
    public function summary(int $days = 30): array
    {
        $window = $this->windowBounds($days);
        $records = $this->recordsWithin($window['from'], $window['to']);

        $totals = [
            'impressions' => (int) $records->sum('impressions'),
            'clicks' => (int) $records->sum('clicks'),
            'conversions' => (int) $records->sum('conversions'),
            'qualified_leads' => (int) $records->sum(fn ($row) => (int) data_get($row->notes, 'qualified_leads', 0)),
            'spend_cents' => (int) $records->sum('spend_cents'),
            'pipeline_value' => round((float) $records->sum('pipeline_value'), 2),
            'partner_touchpoints' => (int) $records->sum('partner_count'),
        ];

        $totals['ctr'] = $totals['impressions'] > 0
            ? round(($totals['clicks'] / max(1, $totals['impressions'])) * 100, 2)
            : 0.0;
        $totals['cpm'] = $totals['impressions'] > 0
            ? round(($totals['spend_cents'] / 100) / ($totals['impressions'] / 1000), 2)
            : 0.0;
        $totals['cpc'] = $totals['clicks'] > 0
            ? round(($totals['spend_cents'] / 100) / max(1, $totals['clicks']), 2)
            : 0.0;
        $totals['cpl'] = $totals['qualified_leads'] > 0
            ? round(($totals['spend_cents'] / 100) / max(1, $totals['qualified_leads']), 2)
            : 0.0;

        $totals['spend'] = round($totals['spend_cents'] / 100, 2);

        return [
            'window' => $window,
            'totals' => $totals,
            'avg_partner_density' => $records->isNotEmpty()
                ? round($records->avg('partner_count'), 1)
                : 0,
        ];
    }

    /**
     * @return (float|int|string)[][]
     *
     * @psalm-return array<int, array{slot_key: string, name: string, surface: string, impressions: int, clicks: int, ctr: float, spend: float, pipeline_value: float, qualified_leads: int, avg_partner_count: float, status: string}>
     */
    public function topSlots(int $days = 30, int $limit = 5): array
    {
        $window = $this->windowBounds($days);
        $records = $this->recordsWithin($window['from'], $window['to']);

        $grouped = $records->groupBy('slot_key');
        if ($grouped->isEmpty()) {
            return [];
        }

        $slotMetadata = AdvertisingSlot::query()
            ->whereIn('key', $grouped->keys())
            ->get()
            ->keyBy('key');

        return $grouped
            ->map(function (Collection $rows, string $slotKey) use ($slotMetadata) {
                $impressions = (int) $rows->sum('impressions');
                $clicks = (int) $rows->sum('clicks');
                $spendCents = (int) $rows->sum('spend_cents');
                $leads = (int) $rows->sum(fn ($row) => (int) data_get($row->notes, 'qualified_leads', 0));
                $slot = $slotMetadata->get($slotKey);

                return [
                    'slot_key' => $slotKey,
                    'name' => $slot?->name ?? Str::headline(str_replace('_', ' ', $slotKey)),
                    'surface' => $slot?->surface_label ?? ucfirst($slotKey),
                    'impressions' => $impressions,
                    'clicks' => $clicks,
                    'ctr' => $impressions > 0 ? round(($clicks / max(1, $impressions)) * 100, 2) : 0.0,
                    'spend' => round($spendCents / 100, 2),
                    'pipeline_value' => round((float) $rows->sum('pipeline_value'), 2),
                    'qualified_leads' => $leads,
                    'avg_partner_count' => round($rows->avg('partner_count'), 1),
                    'status' => $slot?->brand_safety_status ?? 'pending',
                ];
            })
            ->sort(function (array $a, array $b) {
                $spendComparison = $b['spend'] <=> $a['spend'];

                return $spendComparison !== 0
                    ? $spendComparison
                    : $b['pipeline_value'] <=> $a['pipeline_value'];
            })
            ->take($limit)
            ->values()
            ->all();
    }

    /**
     * @return (float|int|null|string)[][]
     *
     * @psalm-return array<int, array{report_date: null|string, impressions: int, clicks: int, ctr: 0|float, spend: float, pipeline_value: float}>
     */
    public function dailyTrend(int $days = 14): array
    {
        $window = $this->windowBounds($days);
        $records = $this->recordsWithin($window['from'], $window['to']);

        return $records
            ->groupBy(fn ($row) => optional($row->report_date)->toDateString())
            ->map(function (Collection $rows, ?string $date) {
                $impressions = (int) $rows->sum('impressions');
                $clicks = (int) $rows->sum('clicks');
                $spend = round(((int) $rows->sum('spend_cents')) / 100, 2);

                return [
                    'report_date' => $date,
                    'impressions' => $impressions,
                    'clicks' => $clicks,
                    'ctr' => $impressions > 0 ? round(($clicks / max(1, $impressions)) * 100, 2) : 0,
                    'spend' => $spend,
                    'pipeline_value' => round((float) $rows->sum('pipeline_value'), 2),
                ];
            })
            ->sortBy('report_date')
            ->values()
            ->all();
    }

    /**
     * @return int[]
     *
     * @psalm-return array{approved: int, pending: int, blocked: int, total: int}
     */
    public function readinessBreakdown(): array
    {
        $totals = AdvertisingSlot::query()
            ->selectRaw('brand_safety_status, COUNT(*) as aggregate')
            ->groupBy('brand_safety_status')
            ->pluck('aggregate', 'brand_safety_status');

        $approved = (int) ($totals[AdvertisingSlot::BRAND_SAFETY_APPROVED] ?? 0);
        $pending = (int) ($totals[AdvertisingSlot::BRAND_SAFETY_PENDING] ?? 0);
        $rejected = (int) ($totals[AdvertisingSlot::BRAND_SAFETY_REJECTED] ?? 0);

        return [
            'approved' => $approved,
            'pending' => $pending,
            'blocked' => $rejected,
            'total' => $approved + $pending + $rejected,
        ];
    }

    /**
     * @psalm-return \Illuminate\Database\Eloquent\Collection<int, AdvertisingSlotRevenueSnapshot>
     */
    private function recordsWithin(string $from, string $to): \Illuminate\Database\Eloquent\Collection
    {
        return AdvertisingSlotRevenueSnapshot::query()
            ->whereBetween('report_date', [$from, $to])
            ->orderBy('report_date')
            ->get();
    }

    /**
     * @return (int|string)[]
     *
     * @psalm-return array{from: string, to: string, days: int<1, 90>}
     */
    private function windowBounds(int $days): array
    {
        $days = max(1, min(90, $days));
        $end = CarbonImmutable::now()->toDateString();
        $start = CarbonImmutable::now()->subDays($days - 1)->toDateString();

        return [
            'from' => $start,
            'to' => $end,
            'days' => $days,
        ];
    }
}

