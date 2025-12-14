<?php

namespace App\Http\Resources\Org;

use Illuminate\Http\Resources\Json\JsonResource;

final class AdCreativeResource extends JsonResource
{
    public static $wrap = null;
    /**
     * @param \Illuminate\Http\Request  $request
     *
     * @return (\Illuminate\Http\Resources\MissingValue|array|mixed)[]
     *
     * @psalm-return array{id: mixed, campaign_id: mixed, media_id: mixed, format: mixed, caption: mixed, cta: mixed, deeplink: mixed, meta: array<never, never>|mixed, status: mixed, campaign: \Illuminate\Http\Resources\MissingValue|mixed, media: \Illuminate\Http\Resources\MissingValue|mixed, created_at: mixed, updated_at: mixed}
     */
    #[\Override]
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'campaign_id' => $this->campaign_id,
            'media_id' => $this->media_id,
            'format' => $this->format,
            'caption' => $this->caption,
            'cta' => $this->cta,
            'deeplink' => $this->deeplink,
            'meta' => $this->meta ?? [],
            'status' => $this->status,
            'campaign' => $this->whenLoaded('campaign', function () {
                return [
                    'id' => $this->campaign->id,
                    'name' => $this->campaign->name,
                    'status' => $this->campaign->status,
                    'org_page_id' => $this->campaign->org_page_id,
                ];
            }),
            'media' => $this->whenLoaded('media', function () {
                return [
                    'id' => $this->media->id,
                    'type' => $this->media->type,
                    'url' => $this->media->url,
                    'thumbnail_url' => $this->media->thumbnail_url,
                    'duration' => $this->media->duration,
                ];
            }),
            'created_at' => optional($this->created_at)->toIso8601String(),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
        ];
    }
}

