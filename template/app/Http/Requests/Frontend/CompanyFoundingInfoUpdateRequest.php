<?php
/**
 * CompanyFoundingInfoUpdateRequest
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Requests\Frontend;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property int|null $industry_type
 * @property int|null $organization_type
 * @property int|null $team_size
 * @property int|null $establishment_date
 * @property int|null $website
 * @property int|null $email
 * @property int|null $phone
 * @property int|null $country
 * @property int|null $state
 * @property int|null $city
 * @property string|null $address
 * @property string|null $map_link
 */
final class CompanyFoundingInfoUpdateRequest extends FormRequest
{
}

