<?php

namespace App\Support\Etl;

final class EtlResult
{
    public function __construct(
        public readonly string $pipeline,
        public readonly bool $successful,
        public readonly float $duration,
        public readonly array $meta = [],
        public readonly ?string $message = null,
    ) {
    }

    public static function success(string $pipeline, float $duration, array $meta = [], ?string $message = null): self
    {
        return new self($pipeline, true, $duration, $meta, $message);
    }

    public static function failure(string $pipeline, float $duration, array $meta = [], ?string $message = null): self
    {
        return new self($pipeline, false, $duration, $meta, $message);
    }

    /**
     * @return (array|bool|float|null|string)[]
     *
     * @psalm-return array{pipeline: string, successful: bool, duration: float, meta: array, message: null|string}
     */
    public function toArray(): array
    {
        return [
            'pipeline' => $this->pipeline,
            'successful' => $this->successful,
            'duration' => $this->duration,
            'meta' => $this->meta,
            'message' => $this->message,
        ];
    }
}

