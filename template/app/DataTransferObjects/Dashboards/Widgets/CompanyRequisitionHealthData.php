<?php

namespace App\DataTransferObjects\Dashboards\Widgets;

use App\DataTransferObjects\Dashboards\AbstractDashboardWidgetData;

final class CompanyRequisitionHealthData extends AbstractDashboardWidgetData
{
    public function __construct(
        public readonly int $openRequisitions,
        public readonly int $rolesAtRisk,
        public readonly float $avgPipelineVelocity,
        public readonly array $agingSummary,
        public readonly array $spotlight = [],
    ) {
    }

    #[\Override]
    /**
     * @return string
     *
     * @psalm-return 'company_requisition_health'
     */
    protected function key(): string
    {
        return 'company_requisition_health';
    }

    #[\Override]
    /**
     * @return (array|float|int)[]
     *
     * @psalm-return array{open_requisitions: int, roles_at_risk: int, avg_pipeline_velocity: float, aging_summary: array, spotlight: array}
     */
    public function toArray(): array
    {
        return [
            'open_requisitions' => $this->openRequisitions,
            'roles_at_risk' => $this->rolesAtRisk,
            'avg_pipeline_velocity' => $this->avgPipelineVelocity,
            'aging_summary' => $this->agingSummary,
            'spotlight' => $this->spotlight,
        ];
    }
}
