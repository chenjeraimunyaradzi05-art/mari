<?php

namespace App\Http\Resources\Org;

use Illuminate\Http\Resources\Json\JsonResource;

final class AdMetricsDailyResource extends JsonResource
{
    public static $wrap = null;
    /**
     * @param \Illuminate\Http\Request  $request
     *
     * @return (int|mixed)[]
     *
     * @psalm-return array{date: mixed, impressions: int, clicks: int, views: int, watch_time_s: int, leads: int, cost_cents: int, conversions: int}
     */
    #[\Override]
    public function toArray($request): array
    {
        return [
            'date' => optional($this->date)->toDateString(),
            'impressions' => (int) $this->impressions,
            'clicks' => (int) $this->clicks,
            'views' => (int) $this->views,
            'watch_time_s' => (int) $this->watch_time_s,
            'leads' => (int) $this->leads,
            'cost_cents' => (int) $this->cost_cents,
            'conversions' => (int) $this->conversions,
        ];
    }
}

