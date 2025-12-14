<?php

namespace App\Http\Requests\Social;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property array<int, mixed>|null $request_type
 * @property array<int, mixed>|null $notes
 * @property array<int, mixed>|null $evidence_urls
 * @property array<int, mixed>|null $evidence_urls.*
 * @property array<int, mixed>|null $attachments
 * @property string|null $attachments.*
 */
final class StoreSocialProfileVerificationRequest extends FormRequest
{
    private const TYPES = ['government_id', 'organization_email', 'document_upload'];

    public function authorize(): bool
    {
        return true; // controller will perform further authorization
    }

    public function rules(): array
    {
        return [
            'request_type' => ['required', 'string', 'in:'.implode(',', self::TYPES)],
            'notes' => ['nullable', 'string', 'max:2000'],
            'evidence_urls' => ['nullable', 'array'],
            'evidence_urls.*' => ['nullable', 'url'],
            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['nullable', 'file'],
        ];
    }
}

