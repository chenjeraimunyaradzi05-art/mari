<?php

declare(strict_types=1);

namespace App\Http\Requests\Grants;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property array<int, mixed>|null $name
 * @property array<int, mixed>|null $filters
 * @property string|null $filters.type
 * @property string|null $filters.provider
 * @property bool|null $filters.industry
 * @property bool|null $filters.state
 * @property bool|null $filters.q
 * @property bool|null $filters.women_only
 * @property bool|null $filters.closing_soon
 * @property bool|null $notify_in_app
 * @property bool|null $notify_email
 */
final class StoreGrantFilterPresetRequest extends FormRequest
{

	public function authorize(): bool
	{
		return true;
	}

	/**
	 * @return array<string, mixed>
	 */
	public function rules(): array
	{
		return [
			'name' => ['required', 'string', 'max:255'],
			'filters' => ['required', 'array'],
			'filters.type' => ['nullable', 'string', 'max:255'],
			'filters.provider' => ['nullable', 'string', 'max:255'],
			'filters.industry' => ['nullable'],
			'filters.state' => ['nullable'],
			'filters.q' => ['nullable', 'string', 'max:255'],
			'filters.women_only' => ['nullable', 'boolean'],
			'filters.closing_soon' => ['nullable', 'boolean'],
			'notify_in_app' => ['nullable', 'boolean'],
			'notify_email' => ['nullable', 'boolean'],
		];
	}

}

