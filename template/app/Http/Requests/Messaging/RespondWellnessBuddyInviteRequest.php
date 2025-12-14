<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property string|null $action
 * @property string|null $message_body
 */
final class RespondWellnessBuddyInviteRequest extends FormRequest
{

}

