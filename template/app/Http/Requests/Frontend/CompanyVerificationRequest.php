<?php

namespace App\Http\Requests\Frontend;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property string|null $abn
 * @property array<int, mixed>|null $asic_number
 * @property array<int, mixed>|null $website
 * @property array<int, mixed>|null $domain
 * @property array<int, mixed>|null $notes
 * @property array<int, mixed>|null $documents
 * @property string|null $documents.*
 */
final class CompanyVerificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && $this->user()->role === 'company';
    }

    /**
     * @return string[][]
     *
     * @psalm-return array{abn: list{'required', 'string', 'min:9', 'max:20'}, asic_number: list{'nullable', 'string', 'max:20'}, website: list{'nullable', 'url', 'max:255'}, domain: list{'nullable', 'string', 'max:255'}, notes: list{'nullable', 'string', 'max:2000'}, documents: list{'required', 'array', 'min:1'}, 'documents.*': list{'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'}}
     */
    public function rules(): array
    {
        return [
            'abn' => ['required', 'string', 'min:9', 'max:20'],
            'asic_number' => ['nullable', 'string', 'max:20'],
            'website' => ['nullable', 'url', 'max:255'],
            'domain' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'documents' => ['required', 'array', 'min:1'],
            'documents.*' => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ];
    }

    #[\Override]
    /**
     * @return string[]
     *
     * @psalm-return array{'documents.*.mimes': 'Documents must be PDF or image files.', 'documents.*.max': 'Documents may not be greater than 10MB.'}
     */
    public function messages(): array
    {
        return [
            'documents.*.mimes' => 'Documents must be PDF or image files.',
            'documents.*.max' => 'Documents may not be greater than 10MB.',
        ];
    }
}

