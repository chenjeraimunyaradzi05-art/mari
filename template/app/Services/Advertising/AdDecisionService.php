<?php

namespace App\Services\Advertising;

use App\Models\AdvertisingSlot;
use App\Models\AdvertisingCampaign;
use App\Models\AdvertisingCreative;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class AdDecisionService
{
    /**
     * Decide which ad to show in a given slot for a user.
     */
    public function decide(string $slotIdentifier, ?User $user = null, array $context = []): ?AdvertisingCreative
    {
        // 1. Find the slot
        $slot = $this->getSlot($slotIdentifier);
        if (!$slot || !$slot->is_active) {
            return null;
        }

        // 2. Get candidate campaigns
        $campaigns = $this->getCandidateCampaigns($slot);

        if ($campaigns->isEmpty()) {
            return null;
        }

        // 3. Filter by targeting (User attributes, Context)
        $eligibleCreatives = $this->filterCreatives($campaigns, $user, $context);

        if ($eligibleCreatives->isEmpty()) {
            return null;
        }

        // 4. Select winner (Simple weighted random for now, can be eCPM based later)
        return $this->selectWinner($eligibleCreatives);
    }

    protected function getSlot(string $identifier): ?AdvertisingSlot
    {
        return Cache::remember("ad_slot:{$identifier}", 300, function () use ($identifier) {
            return AdvertisingSlot::where('identifier', $identifier)->first();
        });
    }

    /**
     * @psalm-return \Illuminate\Database\Eloquent\Collection<int, AdvertisingCampaign>
     */
    protected function getCandidateCampaigns(AdvertisingSlot $slot): \Illuminate\Database\Eloquent\Collection
    {
        // Fetch active campaigns that match the slot's allowed formats
        // This is a simplified query. In production, we'd check budget pacing here too.
        return AdvertisingCampaign::query()
            ->where('status', 'active')
            ->where('starts_at', '<=', now())
            ->where(function ($q) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', now());
            })
            ->with(['creatives' => function ($q) use ($slot) {
                $q->where('status', 'active');
                // $q->whereIn('format', $slot->allowed_formats); // Assuming format check
            }])
            ->get();
    }

    /**
     * @psalm-return Collection<never, never>
     */
    protected function filterCreatives(Collection $campaigns, ?User $user, array $context): Collection
    {
        $creatives = collect();

        foreach ($campaigns as $campaign) {
            // Check Campaign Targeting
            if (!$this->checkTargeting($campaign, $user, $context)) {
                continue;
            }

            foreach ($campaign->creatives as $creative) {
                $creatives->push($creative);
            }
        }

        return $creatives;
    }

    protected function checkTargeting(AdvertisingCampaign $campaign, ?User $user, array $context): bool
    {
        $targeting = $campaign->targeting ?? [];

        // Example: Location Targeting
        if (!empty($targeting['locations']) && $user) {
            // Check if user's location matches
            // This requires User model to have location data accessible
        }

        // Example: Role Targeting
        if (!empty($targeting['roles']) && $user) {
            if (!$user->hasAnyRole($targeting['roles'])) {
                return false;
            }
        }

        return true;
    }

    protected function selectWinner(Collection $creatives): ?AdvertisingCreative
    {
        // Random selection for now
        return $creatives->random();
    }
}

