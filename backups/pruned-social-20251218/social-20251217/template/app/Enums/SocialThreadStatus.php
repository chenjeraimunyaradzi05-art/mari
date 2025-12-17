<?php

namespace App\Enums;

enum SocialThreadStatus: string
{
    case Pending = 'pending';
    case Active = 'active';
    case Archived = 'archived';
    case Suspended = 'suspended';
}
