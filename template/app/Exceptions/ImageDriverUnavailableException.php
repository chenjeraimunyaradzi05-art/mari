<?php

namespace App\Exceptions;

use RuntimeException;

final class ImageDriverUnavailableException extends RuntimeException
{
    public static function create(): self
    {
        return new self('Image processing driver missing');
    }
}

