<?php

namespace App\Enums;

enum ProfileVerificationStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case NeedsMoreInfo = 'needs_more_info';
}
