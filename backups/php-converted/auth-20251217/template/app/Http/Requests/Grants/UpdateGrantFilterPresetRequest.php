<?php

declare(strict_types=1);

namespace App\Http\Requests\Grants;

use App\Models\GrantFilterPreset;
use Illuminate\Foundation\Http\FormRequest;

/**
 * @property bool|null $name
 * @property bool|null $notify_in_app
 * @property bool|null $notify_email
 */
final class UpdateGrantFilterPresetRequest extends FormRequest
{

}

