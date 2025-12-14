<?php

namespace App\Http\Resources\Money;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\BankAccount */
final class BankAccountResource extends JsonResource
{
	/**
	 * Transform the resource into an array.
	 */
	public function toArray(Request $request): array
	{
		return [
			'id' => $this->id,
			'user_id' => $this->user_id,
			'account_name' => $this->account_name,
			'account_number_mask' => $this->account_number_mask,
			'institution' => $this->institution,
			'account_type' => $this->account_type,
			'pending_transactions_count' => $this->pending_transactions_count ?? 0,
			'created_at' => optional($this->created_at)->toIso8601String(),
			'updated_at' => optional($this->updated_at)->toIso8601String(),
		];
	}
}
