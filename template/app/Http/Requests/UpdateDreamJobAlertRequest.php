<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateDreamJobAlertRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Controller will double-check ownership; allow authenticated users here
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'job_title' => 'sometimes|required|string|max:255',
            'industry' => 'sometimes|nullable|string|max:255',
            'location' => 'sometimes|nullable|string|max:255',
            'min_salary' => 'sometimes|nullable|numeric|min:0',
            'required_skills' => 'sometimes|nullable|array',
            'required_skills.*' => 'string|max:100',
            'employment_type' => 'sometimes|nullable|in:full_time,part_time,contract,casual,apprenticeship,traineeship',
            'is_active' => 'sometimes|boolean',
        ];
    }

    protected function prepareForValidation(): void
    {
        $skills = $this->input('required_skills');

        if (is_string($skills)) {
            $converted = array_filter(array_map('trim', explode(',', $skills)));
            $this->merge(['required_skills' => $converted]);
        }
    }
}
