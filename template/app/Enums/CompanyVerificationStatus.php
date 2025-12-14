<?php

namespace App\Enums;

enum CompanyVerificationStatus: string
{
    case Pending = 'pending';
    case UnderReview = 'under_review';
    case Verified = 'verified';
    case Rejected = 'rejected';
    case Suspended = 'suspended';
}
