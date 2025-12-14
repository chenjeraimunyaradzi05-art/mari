<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class BundleOfferResource extends JsonResource
{
    /**
     * @param Request $request
     *
     * @return (\Illuminate\Http\Resources\Json\AnonymousResourceCollection|float|mixed)[]
     *
     * @psalm-return array{id: mixed, bundle_code: mixed, status: mixed, currency: mixed, baseline_monthly_cost: float, projected_monthly_cost: float, projected_savings_monthly: float, projected_savings_annual: float, confidence: float, recommendations: mixed, success_tracking: mixed, impact_projection: mixed, negotiation_script: mixed, referral_code: mixed, provider_payload: mixed, created_at: mixed, line_items: \Illuminate\Http\Resources\Json\AnonymousResourceCollection}
     */
    #[\Override]
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'bundle_code' => $this->bundle_code,
            'status' => $this->status,
            'currency' => $this->currency,
            'baseline_monthly_cost' => (float) $this->baseline_monthly_cost,
            'projected_monthly_cost' => (float) $this->projected_monthly_cost,
            'projected_savings_monthly' => (float) $this->projected_savings_monthly,
            'projected_savings_annual' => (float) $this->projected_savings_annual,
            'confidence' => (float) $this->confidence,
            'recommendations' => $this->recommendations,
            'success_tracking' => $this->success_tracking,
            'impact_projection' => $this->impact_projection,
            'negotiation_script' => $this->negotiation_script,
            'referral_code' => $this->referral_code,
            'provider_payload' => $this->provider_payload,
            'created_at' => optional($this->created_at)->toIso8601String(),
            'line_items' => BundleOfferLineItemResource::collection($this->whenLoaded('lineItems')),
        ];
    }
}

