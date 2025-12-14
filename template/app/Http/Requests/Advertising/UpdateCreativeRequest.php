<?php

namespace App\Http\Requests\Advertising;

use App\Models\AdvertisingCreative;
use Illuminate\Foundation\Http\FormRequest;

/**
 * @property string|null $name
 * @property string|null $format
 * @property string|null $status
 * @property string|null $review_status
 * @property string|null $headline
 * @property string|null $primary_text
 * @property string|null $cta_label
 * @property string|null $destination_url
 * @property string|null $preview_image_url
 * @property string|null $preview_video_url
 * @property string|null $notes
 */
final class UpdateCreativeRequest extends FormRequest
{


    #[\Override]
    /**
     * @return string[]
     *
     * @psalm-return array{'format.in': 'Select a valid creative format option.', 'status.in': 'Choose a valid creative status.', 'review_status.in': 'Review status must be pending, approved, or rejected.'}
     */
    public function messages(): array
    {
        return [
            'format.in' => 'Select a valid creative format option.',
            'status.in' => 'Choose a valid creative status.',
            'review_status.in' => 'Review status must be pending, approved, or rejected.',
        ];
    }

    /**
     * @return (mixed|null|string)[]
     *
     * @psalm-return array{name: mixed, format: mixed, status: mixed, review_status: 'pending'|mixed, headline: mixed|null, primary_text: mixed|null, cta_label: mixed|null, destination_url: mixed|null, preview_image_url: mixed|null, preview_video_url: mixed|null, notes: mixed|null}
     */
    public function creativeData(): array
    {
        $data = $this->validated();

        return [
            'name' => $data['name'],
            'format' => $data['format'],
            'status' => $data['status'],
            'review_status' => $data['review_status'] ?? AdvertisingCreative::REVIEW_PENDING,
            'headline' => $data['headline'] ?? null,
            'primary_text' => $data['primary_text'] ?? null,
            'cta_label' => $data['cta_label'] ?? null,
            'destination_url' => $data['destination_url'] ?? null,
            'preview_image_url' => $data['preview_image_url'] ?? null,
            'preview_video_url' => $data['preview_video_url'] ?? null,
            'notes' => $data['notes'] ?? null,
        ];
    }
}

