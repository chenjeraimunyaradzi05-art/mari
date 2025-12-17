<?php

namespace App\Enums;

enum SocialMessageStatus: string
{
    case Pending = 'pending';
    case Sent = 'sent';
    case Delivered = 'delivered';
    case Failed = 'failed';
    case Held = 'held';
    case Deleted = 'deleted';
}
