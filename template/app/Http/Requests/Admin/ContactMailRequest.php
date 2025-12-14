<?php
/**
 * ContactMailRequest
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property string|null $name
 * @property string|null $email
 * @property string|null $subject
 * @property string|null $message
 */
final class ContactMailRequest extends FormRequest
{

}

