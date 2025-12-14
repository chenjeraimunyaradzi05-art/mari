<?php

declare(strict_types=1);

namespace App\Enums\WomenRealEstate;

enum PartnerIntentionStatus: string
{
    case DRAFT = 'draft';
    case PENDING = 'pending';
    case ACCEPTED = 'accepted';
    case DECLINED = 'declined';
    case WITHDRAWN = 'withdrawn';
}
