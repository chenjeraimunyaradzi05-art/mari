<?php

namespace App\Enums;

enum SocialMessageRequestStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Declined = 'declined';
    case Expired = 'expired';
    case AutoBlocked = 'auto_blocked';
}
