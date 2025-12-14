<?php
/**
 * PlanCreateRequest
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property int|null $label
 * @property int|null $price
 * @property int|null $job_limit
 * @property int|null $featured_job_limit
 * @property int|null $highlight_job_limit
 * @property bool|null $profile_verified
 * @property bool|null $recommended
 * @property bool|null $frontend_show
 */
final class PlanCreateRequest extends FormRequest
{
}

