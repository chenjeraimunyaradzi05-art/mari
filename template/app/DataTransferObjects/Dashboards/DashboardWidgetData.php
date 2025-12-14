<?php

namespace App\DataTransferObjects\Dashboards;

interface DashboardWidgetData
{
    public function widgetKey(): string;

    public function toArray(): array;
}
