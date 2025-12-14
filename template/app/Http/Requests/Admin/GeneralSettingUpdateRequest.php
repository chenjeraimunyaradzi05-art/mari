<?php
/**
 * GeneralSettingUpdateRequest
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property string|null $site_name
 * @property string|null $site_email
 * @property string|null $site_phone
 * @property string|null $site_map
 * @property string|null $site_default_currency
 * @property string|null $site_currency_icon
 */
final class GeneralSettingUpdateRequest extends FormRequest
{
	public function rules(): array
	{
		return [
			'site_name' => ['nullable', 'string', 'max:120'],
			'site_email' => ['nullable', 'email', 'max:255'],
			'site_phone' => ['nullable', 'string', 'max:50'],
			'site_map' => ['nullable', 'url', 'max:512'],
			'site_default_currency' => ['nullable', 'string', 'max:10'],
			'site_currency_icon' => ['nullable', 'string', 'max:20'],

			// Social repost settings (admin editable)
			'social_repost_rate_limit_hours' => ['nullable', 'integer', 'min:0', 'max:168'],
			'social_repost_blocked_moderation_statuses' => ['nullable', 'string', 'max:255'],
			'social_repost_block_on_ai_flags' => ['sometimes', 'boolean'],
			'social_repost_ai_blocked_flags' => ['nullable', 'string', 'max:255'],
		];
	}

}

