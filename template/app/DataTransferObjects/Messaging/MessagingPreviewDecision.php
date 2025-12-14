<?php

namespace App\DataTransferObjects\Messaging;

final class MessagingPreviewDecision
{
    public function __construct(
        public readonly bool $redacted,
        public readonly ?string $reason = null,
        public readonly array $metadata = []
    ) {
    }

    public static function allow(): self
    {
        return new self(false);
    }

    public static function redact(string $reason, array $metadata = []): self
    {
        return new self(true, $reason, $metadata);
    }

    public function isRedacted(): bool
    {
        return $this->redacted;
    }
}

