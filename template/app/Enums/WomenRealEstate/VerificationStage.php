<?php

declare(strict_types=1);

namespace App\Enums\WomenRealEstate;

enum VerificationStage: string
{
    case INITIAL = 'initial';
    case DOCUMENT_REVIEW = 'document_review';
    case REGULATOR_CHECK = 'regulator_check';
    case APPROVED = 'approved';
    case REVERIFICATION = 'reverification';

    public function next(): self
    {
        return match ($this) {
            self::INITIAL => self::DOCUMENT_REVIEW,
            self::DOCUMENT_REVIEW => self::REGULATOR_CHECK,
            self::REGULATOR_CHECK => self::APPROVED,
            self::APPROVED, self::REVERIFICATION => self::REVERIFICATION,
        };
    }
}
