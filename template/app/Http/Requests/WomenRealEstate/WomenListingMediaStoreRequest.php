<?php

declare(strict_types=1);

namespace App\Http\Requests\WomenRealEstate;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @propertystring|null $file
 * @property int|null $type
 * @property int|null $caption
 * @property int|null $position
 * @property array<int, mixed>|null $meta
 */
final class WomenListingMediaStoreRequest extends FormRequest
{
	public function authorize(): bool
	{
		return true;
	}

	public function rules(): array
	{
		return [
			'file' => ['required', 'file'],
			'type' => ['sometimes', 'string'],
			'caption' => ['sometimes', 'nullable', 'string'],
			'position' => ['sometimes', 'nullable', 'integer'],
			'meta' => ['sometimes', 'nullable', 'array'],
		];
	}
}

