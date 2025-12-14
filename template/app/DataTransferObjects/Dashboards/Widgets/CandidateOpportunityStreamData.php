<?php

namespace App\DataTransferObjects\Dashboards\Widgets;

use App\DataTransferObjects\Dashboards\AbstractDashboardWidgetData;

final class CandidateOpportunityStreamData extends AbstractDashboardWidgetData
{
    public function __construct(
        public readonly array $streams,
        public readonly array $spotlight = [],
        public readonly int $pendingApplications = 0,
        public readonly int $interviewsScheduled = 0,
        public readonly int $savedOpportunities = 0,
        public readonly int $mentorshipPrompts = 0,
    ) {
    }

    #[\Override]
    /**
     * @return string
     *
     * @psalm-return 'candidate_opportunity_stream'
     */
    protected function key(): string
    {
        return 'candidate_opportunity_stream';
    }

    #[\Override]
    /**
     * @return (array|int)[]
     *
     * @psalm-return array{streams: array, spotlight: array, pending_applications: int, interviews_scheduled: int, saved_opportunities: int, mentorship_prompts: int}
     */
    public function toArray(): array
    {
        return [
            'streams' => $this->streams,
            'spotlight' => $this->spotlight,
            'pending_applications' => $this->pendingApplications,
            'interviews_scheduled' => $this->interviewsScheduled,
            'saved_opportunities' => $this->savedOpportunities,
            'mentorship_prompts' => $this->mentorshipPrompts,
        ];
    }
}
