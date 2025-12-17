<?php

namespace App\Enums;

enum SocialThreadType: string
{
    case Direct = 'direct';
    case Group = 'group';
    case Broadcast = 'broadcast';

    public function isDirect(): bool
    {
        return $this === self::Direct;
    }
}
