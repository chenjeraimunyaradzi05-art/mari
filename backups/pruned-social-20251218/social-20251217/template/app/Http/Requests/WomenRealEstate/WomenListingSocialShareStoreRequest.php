<?php

declare(strict_types=1);

namespace App\Http\Requests\WomenRealEstate;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property array<int, mixed>|null $platform
 * @property array<int, mixed>|null $share_url
 * @property array<int, mixed>|null $shared_at
 * @property array<int, mixed>|null $meta
 */
final class WomenListingSocialShareStoreRequest extends FormRequest
{
	public function authorize(): bool
	{
		return true;
	}

	public function rules(): array
	{
		return [
			'platform' => ['required', 'string'],
			'share_url' => ['required', 'string'],
			'shared_at' => ['sometimes', 'nullable', 'date'],
			'meta' => ['sometimes', 'nullable', 'array'],
		];
	}
}

