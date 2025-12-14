<?php

namespace App\Http\Resources\Business;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class BusinessCashbookEntryResource extends JsonResource
{
    /**
     * @return ((bool|mixed)[]|bool|float|mixed)[]
     *
     * @psalm-return array{id: mixed, date: mixed, entry_type: mixed, category: mixed, description: mixed, amount: float, is_tax_deductible: bool, ai: array{last_context_token: mixed, last_context_at: mixed, reviewed_by_ai: bool}, metadata: array<never, never>|mixed}
     */
    #[\Override]
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'date' => optional($this->date)->toDateString(),
            'entry_type' => $this->entry_type,
            'category' => $this->category,
            'description' => $this->description,
            'amount' => (float) $this->amount,
            'is_tax_deductible' => (bool) $this->is_tax_deductible,
            'ai' => [
                'last_context_token' => $this->ai_last_context_token,
                'last_context_at' => optional($this->ai_last_context_at)->toIso8601String(),
                'reviewed_by_ai' => (bool) $this->reviewed_by_ai,
            ],
            'metadata' => $this->metadata ?? [],
        ];
    }
}

