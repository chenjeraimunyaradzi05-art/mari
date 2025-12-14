<?php

namespace App\DataTransferObjects\Dashboards\Widgets;

use App\DataTransferObjects\Dashboards\AbstractDashboardWidgetData;

final class CompanyEquityComplianceData extends AbstractDashboardWidgetData
{
    public function __construct(
        public readonly bool $policyAcknowledged,
        public readonly ?string $lastAuditAt,
        public readonly array $alerts = [],
        public readonly array $nextActions = [],
        public readonly array $badges = [],
    ) {
    }

    #[\Override]
    /**
     * @return string
     *
     * @psalm-return 'company_equity_snapshot'
     */
    protected function key(): string
    {
        return 'company_equity_snapshot';
    }

    #[\Override]
    /**
     * @return (array|bool|null|string)[]
     *
     * @psalm-return array{policy_acknowledged: bool, last_audit_at: null|string, alerts: array, next_actions: array, badges: array}
     */
    public function toArray(): array
    {
        return [
            'policy_acknowledged' => $this->policyAcknowledged,
            'last_audit_at' => $this->lastAuditAt,
            'alerts' => $this->alerts,
            'next_actions' => $this->nextActions,
            'badges' => $this->badges,
        ];
    }
}
