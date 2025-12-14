<?php

namespace App\DataTransferObjects\Dashboards;

final class KeyedDashboardWidgetData implements DashboardWidgetData
{
    private readonly array $payload;

    public function __construct(
        private readonly string $key,
        array $data,
    ) {
        $this->payload = $data;
    }

    #[\Override]
    public function widgetKey(): string
    {
        return $this->key;
    }

    #[\Override]
    public function toArray(): array
    {
        return $this->payload;
    }
}
