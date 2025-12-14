<?php

namespace App\Http\Requests;

use App\Models\Profile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property string|null $public
 * @property string|null $network
 * @property string|null $invite_only
 * @property string|null $persona_type
 * @property string|null $display_name
 * @property string|null $handle
 * @property string|null $bio
 * @property string|null $avatar_path
 * @property string|null $cover_path
 * @property bool|null $pronouns
 * @property bool|null $location
 * @property bool|null $gender
 * @property bool|null $age_bracket
 * @property bool|null $women_safety_mode
 * @property string|null $privacy_tier
 * @property string|null $privacy_level
 * @property string|null $dm_policy
 * @property array<int, mixed>|null $tag_policy
 * @property array<int, mixed>|null $mention_policy
 * @property array<int, mixed>|null $location_visibility
 * @property array<int, mixed>|null $goals
 * @property array<int, mixed>|null $goals.*
 * @property array<int, mixed>|null $interests
 * @property array<int, mixed>|null $interests.*
 * @property array<int, mixed>|null $skills
 * @property array<int, mixed>|null $skills.*
 * @property array<int, mixed>|null $health_interests
 * @property string|null $health_interests.*
 */
final class StorePersonaRequest extends FormRequest
{
	public function rules(): array
	{
		return [
			'persona_type' => ['required', Rule::in(Profile::PERSONA_TYPES)],
			'display_name' => ['required', 'string', 'max:255'],
			'handle' => ['required', 'string', 'max:255'],
			'bio' => ['nullable', 'string', 'max:1000'],
			'age_bracket' => ['required', Rule::in(Profile::AGE_BRACKETS)],
			'gender' => ['nullable', 'string'],
			'location' => ['nullable', 'string'],
			'women_safety_mode' => ['nullable', 'boolean'],
			'privacy_tier' => ['nullable', 'string'],
			'privacy_level' => ['nullable', Rule::in(Profile::PRIVACY_LEVELS)],
			'dm_policy' => ['nullable', 'string'],
			'tag_policy' => ['nullable', 'string'],
			'mention_policy' => ['nullable', 'string'],
			'location_visibility' => ['nullable', 'string'],
			'goals' => ['nullable', 'array'],
			'interests' => ['nullable', 'array'],
			'skills' => ['nullable', 'array'],
			'health_interests' => ['nullable', 'array'],
		];
	}

}

