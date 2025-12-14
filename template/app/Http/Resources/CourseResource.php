<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class CourseResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return (OrganizationSummaryResource|\Illuminate\Http\Resources\Json\AnonymousResourceCollection|mixed)[]
     *
     * @psalm-return array{id: mixed, slug: mixed, code: mixed, title: mixed, summary: mixed, type: mixed, mode: mixed, location: mixed, duration_weeks: mixed, cost_cents: mixed, funding: mixed, prerequisites: mixed, outcomes: mixed, tags: mixed, application_url: mixed, contact_email: mixed, contact_phone: mixed, status: mixed, published_at: mixed, provider_org: OrganizationSummaryResource, intakes: \Illuminate\Http\Resources\Json\AnonymousResourceCollection, apprenticeships: \Illuminate\Http\Resources\Json\AnonymousResourceCollection}
     */
    #[\Override]
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'code' => $this->code,
            'title' => $this->title,
            'summary' => $this->summary,
            'type' => $this->type,
            'mode' => $this->mode,
            'location' => $this->location,
            'duration_weeks' => $this->duration_weeks,
            'cost_cents' => $this->cost_cents,
            'funding' => $this->funding,
            'prerequisites' => $this->prerequisites,
            'outcomes' => $this->outcomes,
            'tags' => $this->tags,
            'application_url' => $this->application_url,
            'contact_email' => $this->contact_email,
            'contact_phone' => $this->contact_phone,
            'status' => $this->status,
            'published_at' => $this->published_at,
            'provider_org' => new OrganizationSummaryResource($this->whenLoaded('page')),
            'intakes' => CourseIntakeResource::collection($this->whenLoaded('intakes')),
            'apprenticeships' => ApprenticeshipProgramResource::collection($this->whenLoaded('apprenticeships')),
        ];
    }
}

