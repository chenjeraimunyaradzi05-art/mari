<?php

namespace App\DataTransferObjects\Dashboards\Widgets;

use App\DataTransferObjects\Dashboards\AbstractDashboardWidgetData;

final class CandidateCareerPulseData extends AbstractDashboardWidgetData
{
    public function __construct(
        public readonly ?int $trajectoryScore,
        public readonly ?string $targetRole,
        public readonly ?string $summary,
        public readonly array $metrics = [],
        public readonly ?string $updatedAt = null,
    ) {
    }

    #[\Override]
    /**
     * @return string
     *
     * @psalm-return 'candidate_career_pulse'
     */
    protected function key(): string
    {
        return 'candidate_career_pulse';
    }

    #[\Override]
    /**
     * @return (array|int|null|string)[]
     *
     * @psalm-return array{trajectory_score: int|null, target_role: null|string, summary: null|string, metrics: array, updated_at: null|string}
     */
    public function toArray(): array
    {
        return [
            'trajectory_score' => $this->trajectoryScore,
            'target_role' => $this->targetRole,
            'summary' => $this->summary,
            'metrics' => $this->metrics,
            'updated_at' => $this->updatedAt,
        ];
    }
}
