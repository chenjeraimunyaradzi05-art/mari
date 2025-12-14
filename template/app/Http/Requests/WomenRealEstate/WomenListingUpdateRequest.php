<?php

declare(strict_types=1);

namespace App\Http\Requests\WomenRealEstate;

use App\Enums\WomenRealEstate\ListingAudience;
use App\Enums\WomenRealEstate\ListingIntent;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

/**
 * @property string|null $title
 * @property string|null $summary
 * @property array<int, mixed>|null $description
 * @property array<int, mixed>|null $intent
 * @property array<int, mixed>|null $primary_audience
 * @property int|null $audience_overrides
 * @property int|null $audience_overrides.*
 * @property int|null $agent_id
 * @property int|null $category_id
 * @property int|null $location_id
 * @property int|null $features
 * @property int|null $features.*
 * @property int|null $bedrooms
 * @property int|null $bathrooms
 * @property int|null $car_spaces
 * @property string|null $price
 * @property bool|null $price_frequency
 * @property array<int, mixed>|null $currency
 * @property array<int, mixed>|null $is_ai_safe
 * @property array<int, mixed>|null $ai_insights
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property string|null $uuid
 * @property string|null $slug
 * @property string|null $owner_id
 * @property string|null $is_verified
 * @property string|null $published_at
 */
final class WomenListingUpdateRequest extends FormRequest
{
	public function authorize(): bool
	{
		return true;
	}

	public function rules(): array
	{
		return [
			'title' => ['sometimes', 'required', 'string', 'max:255'],
			'summary' => ['sometimes', 'required', 'string', 'max:1000'],
			'description' => ['sometimes', 'nullable', 'string'],
			'intent' => ['sometimes', new Enum(\App\Enums\WomenRealEstate\ListingIntent::class)],
			'primary_audience' => ['sometimes', new Enum(\App\Enums\WomenRealEstate\ListingAudience::class)],
			'audience_overrides' => ['sometimes', 'nullable', 'array'],
			'audience_overrides.*' => ['string'],
			'agent_id' => ['sometimes', 'nullable', 'integer', 'exists:women_verified_agents,id'],
			'category_id' => ['sometimes', 'nullable', 'integer', 'exists:women_listing_categories,id'],
			'location_id' => ['sometimes', 'nullable', 'integer', 'exists:women_listing_locations,id'],
			'features' => ['sometimes', 'nullable', 'array'],
			'features.*' => ['string'],
			'bedrooms' => ['sometimes', 'nullable', 'integer'],
			'bathrooms' => ['sometimes', 'nullable', 'integer'],
			'car_spaces' => ['sometimes', 'nullable', 'integer'],
			'price' => ['sometimes', 'nullable', 'numeric'],
			'price_frequency' => ['sometimes', 'nullable', 'string'],
			'currency' => ['sometimes', 'nullable', 'string', 'max:3'],
			'is_ai_safe' => ['sometimes', 'nullable', 'boolean'],
			'ai_insights' => ['sometimes', 'nullable', 'array'],
			'expires_at' => ['sometimes', 'nullable', 'date'],
		];
	}
}
