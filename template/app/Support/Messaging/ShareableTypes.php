<?php

namespace App\Support\Messaging;

use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\In;

final class ShareableTypes
{
    /**
     * @return string[]
     *
     * @psalm-return list{'post', 'buddy_invite'}
     */
    public static function allowed(): array
    {
        return ['post', 'buddy_invite'];
    }

    public static function rule(): In
    {
        return Rule::in(self::allowed());
    }
}

