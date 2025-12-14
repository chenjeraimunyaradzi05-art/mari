<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property int|null $target_profile_id
 * @property array<int, mixed>|null $activity_type
 * @property array<int, mixed>|null $location_preference
 * @property array<int, mixed>|null $preferred_schedule
 * @property array<int, mixed>|null $preferred_schedule.*
 * @property array<int, mixed>|null $comfort_preferences
 * @property string|null $comfort_preferences.*
 * @property string|null $intro_message
 */
final class StoreWellnessBuddyInviteRequest extends FormRequest
{
	public function authorize(): bool
	{
		return true;
	}

	public function rules(): array
	{
		return [
			'target_profile_id' => ['required', 'integer', 'exists:profiles,id'],
			'activity_type' => ['nullable', 'string', 'max:255'],
			'location_preference' => ['nullable', 'array'],
			'preferred_schedule' => ['nullable', 'array'],
			'preferred_schedule.*' => ['string', 'max:255'],
			'comfort_preferences' => ['nullable', 'array'],
			'intro_message' => ['nullable', 'string', 'max:1000'],
		];
	}

}

