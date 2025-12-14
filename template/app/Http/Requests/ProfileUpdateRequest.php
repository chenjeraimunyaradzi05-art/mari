<?php
/**
 * ProfileUpdateRequest
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property string|null $name
 * @property string|null $email
 */
final class ProfileUpdateRequest extends FormRequest
{

	public function authorize(): bool
	{
		// Only allow the authenticated user to update their own profile
		return $this->user() !== null;
	}

	/**
	 * Validation rules for updating profile information.
	 *
	 * We keep these minimal and aligned with the tests — name and email are
	 * required, email must be unique for other users.
	 */
	public function rules(): array
	{
		return [
			'name' => ['required', 'string', 'max:255'],
			'email' => [
				'required',
				'email',
				'max:255',
				Rule::unique(User::class)->ignore($this->user()?->id),
			],
		];
	}

}
