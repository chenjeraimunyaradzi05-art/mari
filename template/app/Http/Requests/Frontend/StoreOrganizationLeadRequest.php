<?php

namespace App\Http\Requests\Frontend;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

/**
 * @property string|null $type
 * @property string|null $name
 * @property string|null $email
 * @property string|null $phone
 * @property string|null $message
 * @property string|null $consent
 */
final class StoreOrganizationLeadRequest extends FormRequest
{


    /**
     * Prepare the data for validation.
     */
    #[\Override]
    protected function prepareForValidation(): void
    {
        $this->merge([
            'type' => $this->whenFilled('type', fn ($value) => strtolower(trim((string) $value))),
            'name' => $this->whenFilled('name', fn ($value) => trim((string) $value)),
            'email' => $this->whenFilled('email', fn ($value) => strtolower(trim((string) $value))),
            'phone' => $this->whenFilled('phone', fn ($value) => trim((string) $value)),
            'message' => $this->whenFilled('message', fn ($value) => trim((string) $value)),
        ]);
    }

    /**
     * Custom validation messages.
     *
     * @return string[]
     *
     * @psalm-return array{'consent.accepted': 'You need to agree to the privacy policy before submitting.'}
     */
    #[\Override]
    public function messages(): array
    {
        return [
            'consent.accepted' => 'You need to agree to the privacy policy before submitting.',
        ];
    }

    /**
     * Build the attribute payload for creating a lead.
     *
     * @return ((mixed|string|true)[]|\Illuminate\Support\Carbon|int|mixed|string)[]
     *
     * @psalm-return array{org_page_id: int, type: mixed, contact_name: mixed, contact_email: mixed, contact_phone: mixed, payload: array<string, mixed|string|true>, source: 'org_page_form', status: 'new', utm: array, submitted_at: \Illuminate\Support\Carbon}
     */
    public function toLeadPayload(int $organizationPageId): array
    {
        $data = $this->validated();

        return [
            'org_page_id' => $organizationPageId,
            'type' => Arr::get($data, 'type'),
            'contact_name' => Arr::get($data, 'name'),
            'contact_email' => Arr::get($data, 'email'),
            'contact_phone' => Arr::get($data, 'phone'),
            'payload' => array_filter([
                'message' => Arr::get($data, 'message'),
                'user_agent' => $this->userAgent(),
                'landing_url' => $this->headers->get('referer'),
                'ip_address' => $this->ip(),
                'consent' => true,
            ], fn ($value) => $value !== null && $value !== ''),
            'source' => 'org_page_form',
            'status' => 'new',
            'utm' => $this->utmPayload(),
            'submitted_at' => now(),
        ];
    }

    /**
     * Extract UTM payload for analytics.
     */
    public function utmPayload(): array
    {
        return array_filter($this->only([
            'utm_source',
            'utm_medium',
            'utm_campaign',
            'utm_term',
            'utm_content',
        ]), fn ($value) => $value !== null && $value !== '');
    }
}

