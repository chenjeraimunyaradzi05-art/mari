<?php

declare(strict_types=1);

namespace App\Enums\WomenRealEstate;

enum PartnerMatchStatus: string
{
    case PENDING = 'pending';
    case INTRO_SCHEDULED = 'intro_scheduled';
    case IN_DISCUSSION = 'in_discussion';
    case CONVERTED = 'converted';
    case DECLINED = 'declined';
}
