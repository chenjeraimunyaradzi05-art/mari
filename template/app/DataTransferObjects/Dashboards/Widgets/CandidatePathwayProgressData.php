<?php

namespace App\DataTransferObjects\Dashboards\Widgets;

use App\DataTransferObjects\Dashboards\AbstractDashboardWidgetData;

final class CandidatePathwayProgressData extends AbstractDashboardWidgetData
{
    public function __construct(
        public readonly int $completionPercent,
        public readonly array $milestones,
        public readonly ?string $nextAction = null,
        public readonly ?string $pathwayName = null,
    ) {
    }

    #[\Override]
    /**
     * @return string
     *
     * @psalm-return 'candidate_pathway_progress'
     */
    protected function key(): string
    {
        return 'candidate_pathway_progress';
    }

    #[\Override]
    /**
     * @return (array|int|null|string)[]
     *
     * @psalm-return array{completion_percent: int, milestones: array, next_action: null|string, pathway_name: null|string}
     */
    public function toArray(): array
    {
        return [
            'completion_percent' => $this->completionPercent,
            'milestones' => $this->milestones,
            'next_action' => $this->nextAction,
            'pathway_name' => $this->pathwayName,
        ];
    }
}
