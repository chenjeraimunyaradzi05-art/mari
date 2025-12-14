<?php

namespace App\Http\Requests\Frontend;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property int|null $gender
 * @property int|null $marital_status
 * @property int|null $profession
 * @property string|null $availability
 * @property string|null $skill_you_have
 * @property string|null $language_you_know
 * @property string|null $biography
 */
final class CandidateProfileInfoUpdateRequest extends FormRequest
{
    /**
     * @property string $gender
     * @property string $marital_status
     * @property int $profession
     * @property string $availability
     * @property array<int> $skill_you_have
     * @property array<int> $language_you_know
     * @property string $biography
     */

}

