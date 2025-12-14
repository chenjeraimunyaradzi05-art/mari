<?php

declare(strict_types=1);

namespace App\Enums\WomenRealEstate;

enum PartnerProjectStatus: string
{
    case DRAFT = 'draft';
    case SEEKING_PARTNERS = 'seeking_partners';
    case IN_REVIEW = 'in_review';
    case ACTIVE = 'active';
    case COMPLETED = 'completed';
    case ARCHIVED = 'archived';

    public function isActive(): bool
    {
        return in_array($this, [self::SEEKING_PARTNERS, self::ACTIVE], true);
    }
}
