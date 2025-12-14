<?php

namespace App\Support\Etl;

use Carbon\CarbonInterface;

final class EtlContext
{
    public function __construct(
        public readonly string $pipeline,
        public readonly CarbonInterface $targetDate,
        public readonly array $options = []
    ) {
    }

    /**
     * @param false|null $default
     */
    public function option(string $key, bool|null $default = null): mixed
    {
        return $this->options[$key] ?? $default;
    }
}

