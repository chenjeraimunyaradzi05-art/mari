<?php

namespace App\Http\Requests;

use App\Models\Profile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property bool|null $public
 * @property bool|null $network
 * @property bool|null $invite_only
 * @property bool|null $women_safety_mode
 * @property string|null $privacy_tier
 * @property string|null $privacy_level
 * @property string|null $dm_policy
 * @property string|null $tag_policy
 * @property array<int, mixed>|null $mention_policy
 * @property array<int, mixed>|null $location_visibility
 * @property array<int, mixed>|null $safety_overrides
 * @property array<int, mixed>|null $reason
 * @property array<int, mixed>|null $audit_metadata
 */
final class UpdateProfileSafetyRequest extends FormRequest
{
	public function rules(): array
	{
		return [
			'women_safety_mode' => ['nullable', 'boolean'],
			'privacy_tier' => ['nullable', 'string'],
			'privacy_level' => ['nullable', Rule::in(Profile::PRIVACY_LEVELS)],
			'dm_policy' => ['nullable', 'string'],
			'tag_policy' => ['nullable', 'string'],
			'mention_policy' => ['nullable', 'string'],
			'location_visibility' => ['nullable', 'string'],
			'safety_overrides' => ['nullable', 'array'],
			'reason' => ['nullable', 'string'],
			'audit_metadata' => ['nullable', 'array'],
		];
	}

}

