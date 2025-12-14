<?php

namespace App\Services\Advertising;

use App\Models\AdvertisingCampaignMetric;
use App\Models\AdvertisingCreative;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;

final class AdvertisingMetricIngestionService
{
    public function record(AdvertisingCreative $creative, string $event, array $context = []): void
    {
        $column = $event === 'click' ? 'clicks' : 'impressions';
        $today = CarbonImmutable::now()->startOfDay()->toDateString();

        $metric = AdvertisingCampaignMetric::query()->firstOrCreate(
            [
                'campaign_id' => $creative->campaign_id,
                'recorded_at' => $today,
            ],
            [
                'impressions' => 0,
                'clicks' => 0,
                'conversions' => 0,
                'qualified_leads' => 0,
                'spend_cents' => 0,
                'pipeline_value' => 0,
                'notes' => [],
            ]
        );

        $metric->increment($column);

        $notes = $metric->notes ?? [];
        $slot = Arr::get($context, 'slot');
        $device = Arr::get($context, 'device');

        if ($slot) {
            $notes['slots'][$slot][$column] = ($notes['slots'][$slot][$column] ?? 0) + 1;
        }

        $creativeKey = (string) $creative->id;
        $notes['creatives'][$creativeKey][$column] = ($notes['creatives'][$creativeKey][$column] ?? 0) + 1;

        if ($device) {
            $notes['devices'][$device][$column] = ($notes['devices'][$device][$column] ?? 0) + 1;
        }

        $metric->notes = $notes;
        $metric->save();
    }
}

