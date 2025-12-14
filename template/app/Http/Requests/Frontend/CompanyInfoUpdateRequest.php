<?php
/**
 * CompanyInfoUpdateRequest
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Requests\Frontend;

use App\Models\Company;
use Illuminate\Foundation\Http\FormRequest;

/**
 * @property string|null $logo
 * @property string|null $banner
 * @property string|null $name
 * @property string|null $bio
 * @property string|null $vision
 */
final class CompanyInfoUpdateRequest extends FormRequest
{
}

