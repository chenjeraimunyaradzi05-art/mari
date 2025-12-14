<?php

declare(strict_types=1);

namespace App\Enums\WomenRealEstate;

enum CohortPersona: string
{
    case LEARNER = 'learner';
    case FIRST_HOME_BUYER = 'first_home_buyer';
    case INVESTOR = 'investor';
    case DEVELOPER = 'developer';
    case MENTOR = 'mentor';

    public function label(): string
    {
        return match ($this) {
            self::LEARNER => 'Learner',
            self::FIRST_HOME_BUYER => 'First Home Buyer',
            self::INVESTOR => 'Investor',
            self::DEVELOPER => 'Developer',
            self::MENTOR => 'Mentor',
        };
    }
}
