<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property array<int, mixed>|null $event
 * @property array<int, mixed>|null $properties
 */
final class TrackAnalyticsEventRequest extends FormRequest
{


    #[\Override]
    /**
     * @return string[]
     *
     * @psalm-return array{'event.required': 'An analytics event name is required.', 'event.max': 'Analytics event names may not exceed 120 characters.', 'properties.array': 'Analytics properties must be provided as an associative array.'}
     */
    public function messages(): array
    {
        return [
            'event.required' => 'An analytics event name is required.',
            'event.max' => 'Analytics event names may not exceed 120 characters.',
            'properties.array' => 'Analytics properties must be provided as an associative array.',
        ];
    }

    /**
     * Validation rules for tracking events
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'event' => ['required', 'string', 'max:120'],
            'properties' => ['nullable', 'array'],
        ];
    }
}

