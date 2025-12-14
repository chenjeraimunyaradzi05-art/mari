<?php

namespace App\Enums;

enum SocialVerificationStatus: string
{
    case Unverified = 'unverified';
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case NeedsMoreInfo = 'needs_more_info';

    public function isFinal(): bool
    {
        return in_array($this, [self::Approved, self::Rejected], true);
    }
}
