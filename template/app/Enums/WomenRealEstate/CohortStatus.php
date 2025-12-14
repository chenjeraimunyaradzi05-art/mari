<?php

declare(strict_types=1);

namespace App\Enums\WomenRealEstate;

enum CohortStatus: string
{
    case ACTIVE = 'active';
    case PENDING = 'pending';
    case COMPLETED = 'completed';
    case PAUSED = 'paused';
    case WITHDRAWN = 'withdrawn';
}
