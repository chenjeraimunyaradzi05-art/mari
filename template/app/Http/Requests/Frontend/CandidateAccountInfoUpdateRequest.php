<?php
/**
 * CandidateAccountInfoUpdateRequest
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Requests\Frontend;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property int|null $country
 * @property int|null $state
 final  * @property int|null $city
 * @property string|null $address
 * @property string|null $phone
 * @property string|null $secondary_phone
 * @property string|null $email
 */
final class CandidateAccountInfoUpdateRequest extends FormRequest
{
    /**
     * @property int $country
     * @property int|null $state
     * @property int|null $city
     * @property string|null $address
     * @property string|null $phone
     * @property string|null $secondary_phone
     * @property string|null $email
     */
}
