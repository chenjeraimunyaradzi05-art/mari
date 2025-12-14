<?php

namespace App\Http\Requests\Admin;

use App\Enums\ProfileVerificationStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property string|null $action
 * @property string|null $reason
 * @property string|null $notes
 */
final class ProfileVerificationDecisionRequest extends FormRequest
{
	public function authorize(): bool
	{
		return true; // Controller checks admin auth/guard
	}

	public function rules(): array
	{
		$accepted = collect(ProfileVerificationStatus::cases())->map(fn ($c) => $c->value)->all();

		return [
			'action' => ['required', 'string', 'in:'.implode(',', $accepted)],
			'reason' => ['nullable', 'string', 'max:255'],
			'notes' => ['nullable', 'string', 'max:2000'],
		];
	}

}

