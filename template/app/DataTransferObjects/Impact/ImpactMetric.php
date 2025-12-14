<?php

namespace App\DataTransferObjects\Impact;

final class ImpactMetric
{
    public function __construct(
        public readonly string $key,
        public readonly string $label,
        public readonly int|float $value,
        public readonly ?string $unit = null,
        public readonly int|float|null $change = null,
        public readonly ?string $icon = null,
        public readonly ?string $description = null,
        public readonly array $meta = []
    ) {
    }

    /**
     * @return (array|float|int|null|string)[]
     *
     * @psalm-return array{key: string, label: string, value: float|int, unit: null|string, change: float|int|null, icon: null|string, description: null|string, meta: array}
     */
    public function toArray(): array
    {
        return [
            'key' => $this->key,
            'label' => $this->label,
            'value' => $this->value,
            'unit' => $this->unit,
            'change' => $this->change,
            'icon' => $this->icon,
            'description' => $this->description,
            'meta' => $this->meta,
        ];
    }
}

