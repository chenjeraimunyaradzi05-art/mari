<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class OrganizationSummaryResource extends JsonResource
{
    /**
     * @return array
     *
     * @psalm-return array{id: mixed, slug: mixed, name: mixed, type: mixed, tagline: mixed, mission: mixed, website_url: mixed, contact_email: mixed, contact_phone: mixed}
     */
    #[\Override]
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'type' => $this->type,
            'tagline' => $this->tagline,
            'mission' => $this->mission,
            'website_url' => $this->website_url,
            'contact_email' => $this->contact_email,
            'contact_phone' => $this->contact_phone,
        ];
    }
}

