<?php

declare(strict_types=1);

namespace App\Http\Requests\WomenRealEstate;

use App\Enums\WomenRealEstate\ListingAudience;
use App\Enums\WomenRealEstate\ListingIntent;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

/**
 * @property int|null $per_page
 * @property int|null $intent
 * @property int|null $primary_audience
 * @property int|null $published
 * @property int|null $owner_id
 * @property int|null $agent_id
 * @property final bool|null $search
 * @property bool|null $created_from
 * @property bool|null $created_to
 * @property bool|null $published_from
 * @property bool|null $published_to
 * @property bool|null $refresh_cache
 * @property bool|null $include_agent_details
 */
final class WomenListingIndexRequest extends FormRequest
{
	public function authorize(): bool
	{
		return true;
	}

	public function rules(): array
	{
		return [
			'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
			'intent' => ['sometimes', new Enum(\App\Enums\WomenRealEstate\ListingIntent::class)],
			'primary_audience' => ['sometimes', new Enum(\App\Enums\WomenRealEstate\ListingAudience::class)],
			'published' => ['sometimes', 'boolean'],
			'owner_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
			'agent_id' => ['sometimes', 'nullable', 'integer', 'exists:women_verified_agents,id'],
			'search' => ['sometimes', 'string'],
			'created_from' => ['sometimes', 'date'],
			'created_to' => ['sometimes', 'date'],
			'published_from' => ['sometimes', 'date'],
			'published_to' => ['sometimes', 'date'],
			'refresh_cache' => ['sometimes', 'boolean'],
			'include_agent_details' => ['sometimes', 'boolean'],
		];
	}
}
