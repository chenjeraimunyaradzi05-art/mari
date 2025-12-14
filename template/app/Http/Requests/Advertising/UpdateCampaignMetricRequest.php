<?php

namespace App\Http\Requests\Advertising;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property int|null $recorded_at
 * @property int|null $impressions
 * @property int|null $clicks
 * @property int|null $conversions
 * @property int|null $qualified_leads
 * @property string|null $spend
 * @property string|null $pipeline_value
 * @property string|null $notes
 */
final class UpdateCampaignMetricRequest extends FormRequest
{


    /**
     * @return (array|int|mixed|null)[]
     *
     * @psalm-return array{recorded_at: mixed, impressions: mixed, clicks: mixed, conversions: 0|mixed, qualified_leads: 0|mixed, spend_cents: int, pipeline_value: 0|mixed, notes: array{summary: mixed}|null}
     */
    public function metricData(): array
    {
        $data = $this->validated();

        return [
            'recorded_at' => $data['recorded_at'],
            'impressions' => $data['impressions'],
            'clicks' => $data['clicks'],
            'conversions' => $data['conversions'] ?? 0,
            'qualified_leads' => $data['qualified_leads'] ?? 0,
            'spend_cents' => isset($data['spend']) ? (int) round($data['spend'] * 100) : 0,
            'pipeline_value' => $data['pipeline_value'] ?? 0,
            'notes' => isset($data['notes']) ? ['summary' => $data['notes']] : null,
        ];
    }
}

