<?php

declare(strict_types=1);

namespace App\Enums\WomenRealEstate;

enum CohortRole: string
{
    case LEARNER = 'learner';
    case MENTOR = 'mentor';
    case INVESTOR = 'investor';
    case PARTNER = 'partner';
    case ADMIN = 'admin';

    public function label(): string
    {
        return match ($this) {
            self::LEARNER => 'Learner',
            self::MENTOR => 'Mentor',
            self::INVESTOR => 'Investor',
            self::PARTNER => 'Partner',
            self::ADMIN => 'Admin',
        };
    }
}
