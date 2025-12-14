<?php

declare(strict_types=1);

namespace App\Http\Requests\WomenRealEstate;

use App\Enums\WomenRealEstate\PartnerIntentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;
/**
 * @property int|null $intent
 * @property int|null $invitee_id
 * @property array<int, mixed>|null $preferences
 * @property \Illuminate\Support\Carbon|null|null $message
 * @property \Illuminate\Support\Carbon|null|null $expires_at
 */
class WomenListingPartnerIntentionStoreRequest extends FormRequest

{
	public function authorize(): bool
	{
		return true;
	}

	public function rules(): array
	{
		return [
			'intent' => ['required', new Enum(PartnerIntentType::class)],
			'invitee_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
			'preferences' => ['sometimes', 'nullable', 'array'],
			'message' => ['sometimes', 'nullable', 'string'],
			'expires_at' => ['sometimes', 'nullable', 'date'],
		];
	}

	protected function prepareForValidation(): void
	{
		if ($this->has('intent') && is_string($this->intent)) {
			// keep as string; controller will convert to enum via PartnerIntentType::from()
		}
	}

}
