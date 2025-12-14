<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class ApprenticeshipProgramResource extends JsonResource
{
    /**
     * @return array
     *
     * @psalm-return array{id: mixed, org_page_id: mixed, title: mixed, summary: mixed, requirements: mixed, location: mixed, duration_weeks: mixed, application_url: mixed, status: mixed, meta: mixed, published_at: mixed}
     */
    #[\Override]
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'org_page_id' => $this->org_page_id,
            'title' => $this->title,
            'summary' => $this->summary,
            'requirements' => $this->requirements,
            'location' => $this->location,
            'duration_weeks' => $this->duration_weeks,
            'application_url' => $this->application_url,
            'status' => $this->status,
            'meta' => $this->meta,
            'published_at' => $this->published_at,
        ];
    }
}

