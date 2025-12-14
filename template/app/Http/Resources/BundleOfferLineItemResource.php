<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class BundleOfferLineItemResource extends JsonResource
{
    /**
     * @param Request $request
     *
     * @return (float|mixed)[]
     *
     * @psalm-return array{category: mixed, current_provider: mixed, current_monthly_cost: float, suggested_provider: mixed, suggested_monthly_cost: float, projected_savings_monthly: float, provider_connector: mixed, metadata: mixed}
     */
    #[\Override]
    public function toArray($request): array
    {
        return [
            'category' => $this->category,
            'current_provider' => $this->current_provider,
            'current_monthly_cost' => (float) $this->current_monthly_cost,
            'suggested_provider' => $this->suggested_provider,
            'suggested_monthly_cost' => (float) $this->suggested_monthly_cost,
            'projected_savings_monthly' => (float) $this->projected_savings_monthly,
            'provider_connector' => $this->provider_connector,
            'metadata' => $this->metadata,
        ];
    }
}

