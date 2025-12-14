<?php

namespace App\Events;

use App\Models\Lead;
use App\Models\OrganizationPage;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class LeadSubmitted
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public Lead $lead,
        public OrganizationPage $page
    ) {
    }

    /**
     * @return (array|int|null|string)[]
     *
     * @psalm-return array{lead_id: int, org_page_id: int, org_page_slug: string, org_page_name: string, type: string, source: null|string, submitted_at: string, utm: array}
     */
    public function context(): array
    {
        return [
            'lead_id' => $this->lead->id,
            'org_page_id' => $this->page->id,
            'org_page_slug' => $this->page->slug,
            'org_page_name' => $this->page->name,
            'type' => $this->lead->type,
            'source' => $this->lead->source,
            'submitted_at' => optional($this->lead->submitted_at)->toIso8601String(),
            'utm' => $this->lead->utm ?? [],
        ];
    }
}

