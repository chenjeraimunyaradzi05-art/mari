<?php
/**
 * AboutUsUpdateRequest
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property string|null $image
 * @property string|null $title
 * @property string|null $description
 * @property string|null $url
 */
final class AboutUsUpdateRequest extends FormRequest
{
}

