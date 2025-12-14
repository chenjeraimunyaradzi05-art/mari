<?php

namespace App\Http\Resources\Org;

use Illuminate\Http\Resources\Json\JsonResource;

final class AdCampaignResource extends JsonResource
{
    public static $wrap = null;
    /**
     * @param \Illuminate\Http\Request  $request
     *
     * @return ((float|int)[]|\Illuminate\Http\Resources\MissingValue|int|mixed)[]
     *
     * @psalm-return array{id: mixed, org_page_id: mixed, name: mixed, objective: mixed, billing_model: mixed, budget_cents: int, spent_cents: int, pacing: array{remaining_cents: int<0, max>, progress: 0|float}, start_on: mixed, end_on: mixed, targeting: array<never, never>|mixed, status: mixed, optimisation: array<never, never>|mixed, creatives_count: \Illuminate\Http\Resources\MissingValue|mixed, metrics_summary: \Illuminate\Http\Resources\MissingValue|mixed, page: \Illuminate\Http\Resources\MissingValue|mixed, created_at: mixed, updated_at: mixed}
     */
    #[\Override]
    public function toArray($request): array
    {
        $budgetCents = (int) $this->budget_cents;
        $spentCents = (int) $this->spent_cents;

        return [
            'id' => $this->id,
            'org_page_id' => $this->org_page_id,
            'name' => $this->name,
            'objective' => $this->objective,
            'billing_model' => $this->billing_model,
            'budget_cents' => $budgetCents,
            'spent_cents' => $spentCents,
            'pacing' => [
                'remaining_cents' => max(0, $budgetCents - $spentCents),
                'progress' => $budgetCents > 0 ? round($spentCents / $budgetCents, 4) : 0,
            ],
            'start_on' => optional($this->start_on)->toDateString(),
            'end_on' => optional($this->end_on)->toDateString(),
            'targeting' => $this->targeting ?? [],
            'status' => $this->status,
            'optimisation' => $this->optimisation ?? [],
            'creatives_count' => $this->when(isset($this->creatives_count), (int) $this->creatives_count),
            'metrics_summary' => $this->when(! is_null($this->metrics_summary ?? null), $this->metrics_summary),
            'page' => $this->whenLoaded('page', function () {
                return [
                    'id' => $this->page->id,
                    'name' => $this->page->name,
                    'slug' => $this->page->slug,
                ];
            }),
            'created_at' => optional($this->created_at)->toIso8601String(),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
        ];
    }
}

