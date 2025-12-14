<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenListingSocialShare;
use Illuminate\Support\Arr;

final class WomenListingSocialShareService
{
    public function recordShare(WomenListing $listing, array $payload, ?User $user = null): WomenListingSocialShare
    {
        $share = $listing->socialShares()->create([
            'user_id' => $user?->id,
            'platform' => $payload['platform'],
            'share_url' => $payload['share_url'],
            'shared_at' => $payload['shared_at'] ?? now(),
            'meta' => Arr::get($payload, 'meta', []),
        ]);

        $listing->forceFill([
            'published_via_social' => true,
            'social_boosted_at' => now(),
        ])->save();

        return $share;
    }
}

