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
 * @property int|null $primary_audience
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
 * @property bool|null $price
 * @property array<int, mixed>|null $price_frequency
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
final class WomenListingStoreRequest extends FormRequest
{
	public function authorize(): bool
	{
		return true;
	}

	public function rules(): array
	{
		return [
			'title' => ['required', 'string', 'max:255'],
			'summary' => ['required', 'string', 'max:1000'],
			'description' => ['nullable', 'string'],
			'intent' => ['required', new Enum(\App\Enums\WomenRealEstate\ListingIntent::class)],
			'primary_audience' => ['required', new Enum(\App\Enums\WomenRealEstate\ListingAudience::class)],
			'audience_overrides' => ['nullable', 'array'],
			'audience_overrides.*' => ['string'],
			'agent_id' => ['nullable', 'integer', 'exists:women_verified_agents,id'],
			'category_id' => ['nullable', 'integer', 'exists:women_listing_categories,id'],
			'location_id' => ['nullable', 'integer', 'exists:women_listing_locations,id'],
			'features' => ['nullable', 'array'],
			'features.*' => ['string'],
			'bedrooms' => ['nullable', 'integer'],
			'bathrooms' => ['nullable', 'integer'],
			'car_spaces' => ['nullable', 'integer'],
			'price' => ['nullable', 'numeric'],
			'price_frequency' => ['nullable', 'string'],
			'currency' => ['nullable', 'string', 'max:3'],
			'is_ai_safe' => ['nullable', 'boolean'],
			'ai_insights' => ['nullable', 'array'],
			'expires_at' => ['nullable', 'date'],
		];
	}

	protected function prepareForValidation(): void
	{
		// Normalize fields that can be strings in tests and need conversion.
		if ($this->has('audience_overrides') && is_string($this->audience_overrides)) {
			$this->merge(['audience_overrides' => json_decode($this->audience_overrides, true)]);
		}
	}
}
