<?php

namespace App\Exceptions;

use RuntimeException;

final class AthenaDocumentRateLimitException extends RuntimeException
{
    public function __construct(public readonly int $retryAfter)
    {
        parent::__construct('Too many Athena drafting requests. Try again in '.$retryAfter.' seconds.');
    }
}

