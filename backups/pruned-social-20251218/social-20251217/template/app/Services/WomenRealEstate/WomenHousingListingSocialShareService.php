<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Models\AnalyticsEvent;
use App\Models\WomenHousingListing;

final class WomenHousingListingSocialShareService
{
    public function recordShare(WomenHousingListing $listing, array $payload): AnalyticsEvent
    {
        $meta = $payload['meta'] ?? [];

        return AnalyticsEvent::create([
            'event' => 'women_housing_listing_social_share_generated',
            'source' => 'women_real_estate',
            'properties' => array_filter([
                'listing_id' => $listing->id,
                'listing_uuid' => $listing->uuid,
                'owner_user_id' => $listing->owner_user_id,
                'platform' => $payload['platform'] ?? null,
                'share_url' => $payload['share_url'] ?? null,
                'audience' => $listing->audience,
                'visibility' => $listing->visibility,
                'reason' => $meta['reason'] ?? null,
            ], static fn ($value) => $value !== null && $value !== '' && $value !== []),
            'metadata' => array_filter([
                'hashtags' => $meta['hashtags'] ?? [],
                'photo_url' => $meta['photo'] ?? null,
                'listing_title' => $listing->title,
                'listing_slug' => $listing->slug,
                'listing_type' => $listing->listing_type,
            ], static fn ($value) => $value !== null && $value !== '' && $value !== []),
            'received_at' => now(),
        ]);
    }
}

