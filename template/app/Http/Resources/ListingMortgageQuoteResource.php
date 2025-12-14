<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class ListingMortgageQuoteResource extends JsonResource
{
    /**
     * @param  \App\Models\ListingMortgageQuote  $resource
     */
    public function __construct($resource)
    {
        parent::__construct($resource);
    }

    #[\Override]
    /**
     * @return (\Illuminate\Http\Resources\MissingValue|mixed)[]
     *
     * @psalm-return array{id: mixed, principal_amount_cents: mixed, deposit_amount_cents: mixed, loan_term_months: mixed, repayment_frequency: mixed, calculated_repayment_cents: mixed, risk_rating: mixed, ai_commentary: mixed, generated_at: mixed, rate_snapshot: \Illuminate\Http\Resources\MissingValue|mixed}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'principal_amount_cents' => $this->principal_amount_cents,
            'deposit_amount_cents' => $this->deposit_amount_cents,
            'loan_term_months' => $this->loan_term_months,
            'repayment_frequency' => $this->repayment_frequency,
            'calculated_repayment_cents' => $this->calculated_repayment_cents,
            'risk_rating' => $this->risk_rating,
            'ai_commentary' => $this->ai_commentary,
            'generated_at' => optional($this->generated_at)->toISOString(),
            'rate_snapshot' => $this->whenLoaded('rateSnapshot', function () {
                $snapshot = $this->rateSnapshot;

                return [
                    'id' => $snapshot->id,
                    'provider' => $snapshot->provider,
                    'product_name' => $snapshot->product_name,
                    'interest_rate' => $snapshot->interest_rate,
                    'comparison_rate' => $snapshot->comparison_rate,
                    'apr' => $snapshot->apr,
                    'term_months' => $snapshot->term_months,
                    'available_to' => $snapshot->available_to,
                    'feature_flags' => $snapshot->feature_flags,
                    'captured_at' => optional($snapshot->captured_at)->toISOString(),
                ];
            }),
        ];
    }
}

