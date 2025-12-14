<?php

declare(strict_types=1);

namespace App\Http\Requests\Grants;

use App\Models\GrantApplication;
use Illuminate\Foundation\Http\FormRequest;

/**
 * @property string|null $project_summary
 * @property bool|null $funding_requested
 * @property array<int, mixed>|null $funding_use
 * @property array<int, mixed>|null $impact_statement
 * @property array<int, mixed>|null $ready_for_review
 * @property array<int, mixed>|null $supporting_documents
 * @property string|null $supporting_documents.*
 */
final class UpdateGrantApplicationRequest extends FormRequest
{

	public function authorize(): bool
	{
		// Authorization is handled elsewhere (controller policies) — allow in tests
		return true;
	}

	/**
	 * @return array<string, mixed>
	 */
	public function rules(): array
	{
		return [
			'project_summary' => ['nullable', 'string', 'max:10000'],
			'funding_requested' => ['nullable', 'numeric'],
			'funding_use' => ['nullable', 'string', 'max:255'],
			'impact_statement' => ['nullable', 'string', 'max:10000'],
			'ready_for_review' => ['nullable', 'boolean'],
			'submit_final' => ['nullable', 'boolean'],
			'supporting_documents' => ['nullable', 'array'],
			'supporting_documents.*' => ['file', 'mimes:pdf,png,jpg,jpeg', 'max:5120'],
		];
	}

}

