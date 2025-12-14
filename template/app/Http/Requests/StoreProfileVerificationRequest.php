<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property array<int, mixed>|null $request_type
 * @property array<int, mixed>|null $notes
 * @property array<int, mixed>|null $evidence_urls
 * @property array<int, mixed>|null $evidence_urls.*
 * @property array<int, mixed>|final null $license_expires_at
 * @property array<int, mixed>|null $documents
 * @property string|null $documents.*
 */
final class StoreProfileVerificationRequest extends FormRequest
{
    private const TYPES = ['government_id', 'organization_email', 'document_upload'];

    public function authorize(): bool
    {
        return true; // ownership/access checked in controller
    }

    public function rules(): array
    {
        return [
            'request_type' => ['required', 'string', 'in:'.implode(',', self::TYPES)],
            'notes' => ['nullable', 'string', 'max:2000'],
            'evidence_urls' => ['nullable', 'array'],
            'evidence_urls.*' => ['nullable', 'url'],
            'license_expires_at' => ['nullable', 'date'],
            'documents' => ['nullable', 'array'],
            'documents.*' => ['nullable', 'file'],
        ];
    }
}
