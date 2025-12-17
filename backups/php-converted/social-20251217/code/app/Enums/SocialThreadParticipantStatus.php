<?php

namespace App\Enums;

enum SocialThreadParticipantStatus: string
{
    case Active = 'active';
    case Pending = 'pending';
    case Left = 'left';
    case Blocked = 'blocked';
    case Removed = 'removed';
}
