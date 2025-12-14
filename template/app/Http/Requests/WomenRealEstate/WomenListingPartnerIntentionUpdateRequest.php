<?php

declare(strict_types=1);

namespace App\Http\Requests\WomenRealEstate;

use App\Enums\WomenRealEstate\PartnerIntentionStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

final class WomenListingPartnerIntentionUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', new Enum(PartnerIntentionStatus::class)],
            'message' => ['sometimes', 'nullable', 'string'],
        ];
    }
}
