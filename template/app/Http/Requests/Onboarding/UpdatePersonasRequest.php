<?php

namespace App\Http\Requests\Onboarding;

use App\Enums\UserPersona;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property array<int, mixed>|null $personas
 * @property string|null $personas.*
 */
final class UpdatePersonasRequest extends FormRequest
{
	public function authorize(): bool
	{
		return true;
	}

	public function rules(): array
	{
		$allowed = array_map(fn (UserPersona $p) => $p->value, UserPersona::cases());

		return [
			'personas' => ['required', 'array'],
			'personas.*' => ['string', Rule::in($allowed)],
		];
	}
}

