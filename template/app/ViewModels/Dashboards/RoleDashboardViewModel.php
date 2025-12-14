<?php

namespace App\ViewModels\Dashboards;

use App\DataTransferObjects\Dashboards\DashboardWidgetData;

final class RoleDashboardViewModel
{
    /**
     * @param  array<int, DashboardWidgetData>  $widgets
     */
    public function __construct(
        public readonly string $role,
        public readonly string $title,
        public readonly ?string $description,
        public readonly ?string $featureFlag,
        public readonly int $cacheTtl,
        public readonly array $widgets,
        public readonly array $meta = [],
    ) {
    }

    /**
     * @return (((array|string)[]|mixed)[]|int|null|string)[]
     *
     * @psalm-return array{role: string, title: string, description: null|string, feature_flag: null|string, cache_ttl: int, widgets: array<int, array{key: string, payload: array}>, meta: array}
     */
    public function toArray(): array
    {
        return [
            'role' => $this->role,
            'title' => $this->title,
            'description' => $this->description,
            'feature_flag' => $this->featureFlag,
            'cache_ttl' => $this->cacheTtl,
            'widgets' => array_map(static fn (DashboardWidgetData $widget) => [
                'key' => $widget->widgetKey(),
                'payload' => $widget->toArray(),
            ], $this->widgets),
            'meta' => $this->meta,
        ];
    }
}
