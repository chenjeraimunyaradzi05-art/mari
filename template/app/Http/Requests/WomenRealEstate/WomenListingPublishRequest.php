<?php

declare(strict_types=1);

namespace App\Http\Requests\WomenRealEstate;

use Illuminate\Foundation\Http\FormRequest;

final class WomenListingPublishRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'published_at' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
