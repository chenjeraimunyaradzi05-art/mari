<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property int|null $title
 * @property int|null $company
 * @property int|null $category
 * @property int|null $vacancies
 * @property int|null $deadline
 * @property int|null $country
 * @property int|null $state
 * @property int|null $city
 * @property string|null $address
 * @property int|null $salary_mode
 * @property int|null $min_salary
 * @property int|null $max_salary
 * @property int|null $custom_salary
 * @property int|null $salary_type
 * @property int|null $experience
 * @property int|null $job_role
 * @property int|null $education
 * @property int|null $job_type
 * @property string|null $tags
 * @property string|null $benefits
 * @property string|null $skills
 final  * @property string|null $receive_applications
 * @property string|null $description
 */
final class JobCreateRequest extends FormRequest
{

}
