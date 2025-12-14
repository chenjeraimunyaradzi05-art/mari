<?php

namespace App\Http\Requests\Lead;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

/**
 * @property bool|null $status
 * @property bool|null $assign_to_me
 * @property bool|null $clear_assignment
 * @property bool|null $requalify
 */
final class UpdateLeadStatusRequest extends FormRequest
{


	#[\Override]
	/**
	 * @return string[]
	 *
	 * @psalm-return array{'status.in': 'Please select a valid status for the lead.'}
	 */
	public function messages(): array
	{
		return [
			'status.in' => 'Please select a valid status for the lead.',
		];
	}
}

