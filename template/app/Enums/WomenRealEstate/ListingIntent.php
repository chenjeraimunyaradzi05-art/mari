<?php

declare(strict_types=1);

namespace App\Enums\WomenRealEstate;

enum ListingIntent: string
{
    case RENT = 'rent';
    case CO_LIVING = 'co_living';
    case SALE = 'sale';
    case INVESTMENT = 'investment';
    case DEVELOPMENT_PARTNER = 'development_partner';
}
