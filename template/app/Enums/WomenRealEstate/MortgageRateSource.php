<?php

declare(strict_types=1);

namespace App\Enums\WomenRealEstate;

enum MortgageRateSource: string
{
    case RBA = 'rba';
    case APRA = 'apra';
    case PROVIDER_FEED = 'provider_feed';
    case MANUAL = 'manual';
}
