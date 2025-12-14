<?php

declare(strict_types=1);

namespace App\Enums\WomenRealEstate;

enum GoalType: string
{
    case SAVINGS = 'savings';
    case DEPOSIT = 'deposit';
    case INVESTMENT = 'investment';
    case DEVELOPMENT = 'development';
    case EDUCATION = 'education';

    public function label(): string
    {
        return match ($this) {
            self::SAVINGS => 'Savings',
            self::DEPOSIT => 'Deposit',
            self::INVESTMENT => 'Investment',
            self::DEVELOPMENT => 'Development',
            self::EDUCATION => 'Education',
        };
    }
}
