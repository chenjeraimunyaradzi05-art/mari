<?php

namespace App\Enums;

enum SocialMessageReportStatus: string
{
    case Open = 'open';
    case Investigating = 'investigating';
    case Resolved = 'resolved';
    case Dismissed = 'dismissed';
}
