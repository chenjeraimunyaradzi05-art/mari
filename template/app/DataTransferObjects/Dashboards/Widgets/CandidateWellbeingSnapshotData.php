<?php

namespace App\DataTransferObjects\Dashboards\Widgets;

use App\DataTransferObjects\Dashboards\AbstractDashboardWidgetData;

final class CandidateWellbeingSnapshotData extends AbstractDashboardWidgetData
{
    public function __construct(
        public readonly string $stressLevel,
        public readonly string $budgetHealth,
        public readonly ?string $housingStatus = null,
        public readonly array $alerts = [],
        public readonly array $financialSnapshot = [],
    ) {
    }

    #[\Override]
    /**
     * @return string
     *
     * @psalm-return 'candidate_wellbeing_snapshot'
     */
    protected function key(): string
    {
        return 'candidate_wellbeing_snapshot';
    }

    #[\Override]
    /**
     * @return (array|null|string)[]
     *
     * @psalm-return array{stress_level: string, budget_health: string, housing_status: null|string, alerts: array, financial_snapshot: array}
     */
    public function toArray(): array
    {
        return [
            'stress_level' => $this->stressLevel,
            'budget_health' => $this->budgetHealth,
            'housing_status' => $this->housingStatus,
            'alerts' => $this->alerts,
            'financial_snapshot' => $this->financialSnapshot,
        ];
    }
}
