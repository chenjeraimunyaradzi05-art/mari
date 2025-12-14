<?php

namespace App\DataTransferObjects\Dashboards;

abstract class AbstractDashboardWidgetData implements DashboardWidgetData
{
    abstract protected function key(): string;

    #[\Override]
    public function widgetKey(): string
    {
        return $this->key();
    }
}
