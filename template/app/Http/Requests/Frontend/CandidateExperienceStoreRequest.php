<?php
/**
 * CandidateExperienceStoreRequest
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Requests\Frontend;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property \Illuminate\Support\Carbon|null|null $company
 * @property \Illuminate\Support\Carbon|null|null $department
 * @property \Illuminate\Support\Carbon|null|null $designation
 * @property \Illuminate\Support\Carbon|null|null $start
 * @property \Illuminate\Support\Carbon|null|null $end
 * @property string|null $currently_working
 * @property string|null $responsibilities
 */
final class CandidateExperienceStoreRequest extends FormRequest
{

}

