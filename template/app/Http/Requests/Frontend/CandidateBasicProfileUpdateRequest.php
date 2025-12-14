<?php

namespace App\Http\Requests\Frontend;

use App\Models\Candidate;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Request object used when updating a candidate's basic profile information.
 *
 * @property int|null    $profile_picture
 * @property int|null    $cv
 * @property string|null $full_name
 * @property string|null $title
 * @property int|null    $experience_level
 * @property string|null $website
 * @property string|null $date_of_birth
 */
final class CandidateBasicProfileUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        // permission checks are handled elsewhere; allow by default for now
        return true;
    }


    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $rules =  [
            'profile_picture' => ['image', 'max:3000'],
            'cv' => ['nullable', 'mimes:pdf,csv,epub', 'max:10000'],
            'full_name' => ['required', 'max:50'],
            'title' => ['nullable', 'max:255', 'string'],
            'experience_level' => ['required', 'integer'],
            'website' => ['nullable', 'active_url'],
            'date_of_birth' => ['required', 'date'],
        ];

        $candidate = Candidate::where('user_id', auth()->user()->id)->first();

        if(empty($candidate) || !$candidate?->image) {
            $rules['profile_picture'][] = 'required';
        }

        return $rules;

    }
}
