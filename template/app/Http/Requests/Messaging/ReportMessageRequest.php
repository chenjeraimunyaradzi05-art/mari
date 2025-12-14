<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property string|null $reason
 * @property string|null $notes
 * @property array|null $metadata
 */
final class ReportMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Authorization is handled by controller policies. Allow requests through
        // so validation can run and the controller will abort if the actor is
        // not permitted.
        return true;
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'in:harassment,discrimination,spam,scam,threat,other'],
            'notes' => ['nullable', 'string'],
            'metadata' => ['nullable', 'array'],
        ];
    }
    private const REASONS = [
        'harassment',
        'discrimination',
        'spam',
        'scam',
        'threat',
        'other',
    ];
}
