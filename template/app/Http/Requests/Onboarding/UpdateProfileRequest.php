<?php

namespace App\Http\Requests\Onboarding;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property string|null $name
 * @property string|null $preferred_name
 * @property string|null $pronouns
 * @property string|null $timezone
 */
final class UpdateProfileRequest extends FormRequest
{
	public function authorize(): bool
	{
		// Allow authenticated users to update their onboarding profile
		return true;
	}

	public function rules(): array
	{
		return [
			'name' => ['nullable', 'string', 'max:255'],
			'preferred_name' => ['nullable', 'string', 'max:255'],
			'pronouns' => ['nullable', 'string', 'max:255'],
			'timezone' => ['nullable', 'string', 'max:255', 'timezone'],
		];
	}

}


