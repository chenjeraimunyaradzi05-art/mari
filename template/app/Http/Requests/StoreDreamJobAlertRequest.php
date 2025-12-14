<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreDreamJobAlertRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'job_title' => 'required|string|max:255',
            'industry' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'min_salary' => 'nullable|numeric|min:0',
            'required_skills' => 'nullable|array',
            'required_skills.*' => 'string|max:100',
            'employment_type' => 'nullable|in:full_time,part_time,contract,casual,apprenticeship,traineeship',
            'is_active' => 'boolean',
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
