<?php

namespace App\Enums;

enum SocialThreadRequestMode: string
{
    case Auto = 'auto';
    case Followers = 'followers';
    case Manual = 'manual';
    case Closed = 'closed';
}
