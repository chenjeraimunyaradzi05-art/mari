<?php

declare(strict_types=1);

namespace App\Enums\WomenRealEstate;

enum PartnerIntentType: string
{
    case CO_PURCHASE = 'co_purchase';
    case CO_LIVING = 'co_living';
    case CO_DEVELOP = 'co_develop';
    case INVESTMENT = 'investment';

    public function label(): string
    {
        return match ($this) {
            self::CO_PURCHASE => 'Co-purchase',
            self::CO_LIVING => 'Co-living',
            self::CO_DEVELOP => 'Co-develop',
            self::INVESTMENT => 'Investment',
        };
    }
}
