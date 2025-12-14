<?php

declare(strict_types=1);

namespace App\Enums\WomenRealEstate;

enum ListingAudience: string
{
    case WOMEN_ONLY = 'women_only';
    case STUDENTS = 'students';
    case FIRST_HOME_BUYERS = 'first_home_buyers';
    case INVESTORS = 'investors';
    case AGENTS = 'agents';
    case PARTNERSHIP = 'partnership';
}
