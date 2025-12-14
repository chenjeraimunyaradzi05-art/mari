<?php
/**
 * CandidateEducationStoreRequest
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Requests\Frontend;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property int|null $level
 * @property int|null $degree
 * @property int|null $year
 * @property string|null $note
 */
final class CandidateEducationStoreRequest extends FormRequest
{
}

