<?php

namespace App\Http\Resources\Money;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\BankTransaction */
final class BankTransactionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return (\Illuminate\Http\Resources\MissingValue|array|mixed|null|scalar)[]
     *
     * @psalm-return array{id: int, bank_account_id: int, user_id: int, posted_at: string, description: string, reference: null|string, amount_cents: int, amount: float, direction: string, status: string, category_key: null|string, ai_suggestions: array, is_flagged: bool, reviewed_at: string, ai_last_context_token: mixed|null, ai_last_context_at: mixed|null, metadata: array, created_at: string, updated_at: string, account: \Illuminate\Http\Resources\MissingValue|mixed}
     */
    #[\Override]
    public function toArray(Request $request): array
    {
        $metadata = $this->metadata ?? [];

        return [
            'id' => $this->id,
            'bank_account_id' => $this->bank_account_id,
            'user_id' => $this->user_id,
            'posted_at' => optional($this->posted_at)->toDateString(),
            'description' => $this->description,
            'reference' => $this->reference,
            'amount_cents' => $this->amount_cents,
            'amount' => $this->amount,
            'direction' => $this->direction,
            'status' => $this->status,
            'category_key' => $this->category_key,
            'ai_suggestions' => $this->ai_suggestions ?? [],
            'is_flagged' => (bool) $this->is_flagged,
            'reviewed_at' => optional($this->reviewed_at)->toIso8601String(),
            'ai_last_context_token' => $metadata['ai_last_context_token'] ?? null,
            'ai_last_context_at' => $metadata['ai_last_context_at'] ?? null,
            'metadata' => $metadata,
            'created_at' => optional($this->created_at)->toIso8601String(),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
            'account' => $this->whenLoaded('account', fn () => [
                'id' => $this->account->id,
                'account_name' => $this->account->account_name,
                'account_number_mask' => $this->account->account_number_mask,
                'institution' => $this->account->institution,
                'account_type' => $this->account->account_type,
            ]),
        ];
    }
}
