<?php

declare(strict_types=1);

namespace App\Http\Resources\WomenRealEstate;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class WomenListingResource extends JsonResource
{
    /**
     * @return (\Illuminate\Http\Resources\MissingValue|array|bool|float|mixed|null)[]
     *
     * @psalm-return array{id: mixed, uuid: mixed, owner_id: mixed, agent_id: mixed, category_id: mixed, location_id: mixed, title: mixed, slug: mixed, intent: mixed, primary_audience: mixed, audience_overrides: list<mixed>, audience_values: array<int, mixed>, summary: mixed, description: mixed, features: array<never, never>|mixed, bedrooms: mixed, bathrooms: mixed, car_spaces: mixed, price: float|null, price_frequency: mixed, currency: mixed, is_verified: bool, is_ai_safe: bool, ai_insights: array<never, never>|mixed, published_at: mixed, expires_at: mixed, created_at: mixed, updated_at: mixed, agent: \Illuminate\Http\Resources\MissingValue|mixed, category: \Illuminate\Http\Resources\MissingValue|mixed, location: \Illuminate\Http\Resources\MissingValue|mixed, media: \Illuminate\Http\Resources\MissingValue|mixed, social_shares: \Illuminate\Http\Resources\MissingValue|mixed, partner_intention_summary: \Illuminate\Http\Resources\MissingValue|mixed}
     */
    #[\Override]
    public function toArray(Request $request): array
    {
        $audienceValues = collect($this->audienceValues ?? [])
            ->map(static fn ($audience) => is_object($audience) && property_exists($audience, 'value') ? $audience->value : $audience)
            ->filter()
            ->values()
            ->all();

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'owner_id' => $this->owner_id,
            'agent_id' => $this->agent_id,
            'category_id' => $this->category_id,
            'location_id' => $this->location_id,
            'title' => $this->title,
            'slug' => $this->slug,
            'intent' => $this->intent?->value ?? $this->intent,
            'primary_audience' => $this->primary_audience?->value ?? $this->primary_audience,
            'audience_overrides' => array_values($this->audience_overrides ?? []),
            'audience_values' => $audienceValues,
            'summary' => $this->summary,
            'description' => $this->description,
            'features' => $this->features ?? [],
            'bedrooms' => $this->bedrooms,
            'bathrooms' => $this->bathrooms,
            'car_spaces' => $this->car_spaces,
            'price' => $this->price !== null ? (float) $this->price : null,
            'price_frequency' => $this->price_frequency,
            'currency' => $this->currency,
            'is_verified' => (bool) $this->is_verified,
            'is_ai_safe' => (bool) $this->is_ai_safe,
            'ai_insights' => $this->ai_insights ?? [],
            'published_at' => optional($this->published_at)->toISOString(),
            'expires_at' => optional($this->expires_at)->toISOString(),
            'created_at' => optional($this->created_at)->toISOString(),
            'updated_at' => optional($this->updated_at)->toISOString(),
            'agent' => $this->whenLoaded('agent', function () {
                return [
                    'id' => $this->agent->id,
                    'user_id' => $this->agent->user_id,
                    'status' => $this->agent->status,
                    'verified_at' => optional($this->agent->verified_at)->toISOString(),
                ];
            }),
            'category' => $this->whenLoaded('category', function () {
                return [
                    'id' => $this->category->id,
                    'slug' => $this->category->slug,
                    'name' => $this->category->name,
                ];
            }),
            'location' => $this->whenLoaded('location', function () {
                return [
                    'id' => $this->location->id,
                    'slug' => $this->location->slug,
                    'name' => $this->location->name,
                    'type' => $this->location->type,
                ];
            }),
            'media' => $this->whenLoaded('media', fn () => $this->media->map(fn ($media) => [
                'id' => $media->id,
                'type' => $media->type,
                'path' => $media->path,
                'caption' => $media->caption,
                'position' => $media->position,
                'meta' => $media->meta ?? [],
            ])->all()),
            'social_shares' => $this->whenLoaded('socialShares', fn () => $this->socialShares->map(fn ($share) => [
                'id' => $share->id,
                'platform' => $share->platform,
                'share_url' => $share->share_url,
                'shared_at' => optional($share->shared_at)->toISOString(),
                'meta' => $share->meta ?? [],
            ])->all()),
            'partner_intention_summary' => $this->whenLoaded('partnerIntentions', function () {
                $grouped = $this->partnerIntentions->groupBy(fn ($intention) => $intention->status?->value ?? $intention->status);

                return $grouped->map(fn ($collection) => $collection->count())->all();
            }),
        ];
    }
}

