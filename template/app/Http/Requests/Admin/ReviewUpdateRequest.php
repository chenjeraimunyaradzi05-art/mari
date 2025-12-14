<?php
/**
 * ReviewUpdateRequest
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property string|null $image
 * @property string|null $name
 * @property string|null $title
 * @property string|null $review
 * @property string|null $rating
 */
final class ReviewUpdateRequest extends FormRequest
{
}

