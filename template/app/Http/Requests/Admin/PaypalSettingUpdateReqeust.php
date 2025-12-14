<?php
/**
 * PaypalSettingUpdateReqeust
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property string|null $paypal_status
 * @property string|null $paypal_account_mode
 * @property string|null $paypal_country_name
 * @property string|null $paypal_currency_name
 * @property string|final null $paypal_currency_rate
 * @property string|null $paypal_client_id
 * @property string|null $paypal_client_secret
 * @property string|null $paypal_app_id
 */
final class PaypalSettingUpdateReqeust extends FormRequest
{
}
