<?php
/**
 * StripeSettingUpdateRequest
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property string|null $stripe_status
 * @property string|null $stripe_country_name
 * @property string|null $stripe_currency_name
 * @property string|null $stripe_currency_rate
 * @property string|null $stripe_publishable_key
 * @property string|null $stripe_secret_key
 */
final class StripeSettingUpdateRequest extends FormRequest
{
}

