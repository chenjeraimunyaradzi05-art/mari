<?php

declare(strict_types=1);

namespace App\Policies\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use App\Support\IntentEvaluator;
use Illuminate\Auth\Access\HandlesAuthorization;

final class WomenListingPolicy
{
    use HandlesAuthorization;

    public function create(User $user): bool
    {
        return $this->canModerate($user)
            || IntentEvaluator::for($user)->allowsContext('housing');
    }

    public function update(User $user, WomenListing $listing): bool
    {
        return $this->canModerate($user)
            || $this->isListingOwner($user, $listing)
            || $this->isListingAgent($user, $listing);
    }

    protected function canModerate(User $user): bool
    {
        return $user->hasAnyRole(['Super Admin', 'Admin', 'Moderator']);
    }

    protected function isListingOwner(User $user, WomenListing $listing): bool
    {
        return $listing->owner_id === $user->id;
    }

    protected function isListingAgent(User $user, WomenListing $listing): bool
    {
        $agent = $this->resolveAgent($listing);

        return $agent?->user_id === $user->id;
    }

    protected function resolveAgent(WomenListing $listing): ?WomenVerifiedAgent
    {
        if ($listing->relationLoaded('agent')) {
            return $listing->agent;
        }

        return $listing->agent()->first();
    }

    public function viewAny(User $user): bool
    {
        // Allow authenticated users to query listings; controllers will scope
        // results according to moderation/ownership rules.
        return true;
    }

    public function view(User $user, WomenListing $listing): bool
    {
        return $this->canModerate($user)
            || $this->isListingOwner($user, $listing)
            || IntentEvaluator::for($user)->allowsContext('housing');
    }

    public function publish(User $user, WomenListing $listing): bool
    {
        if ($this->canModerate($user)) {
            return true;
        }

        if (! $this->isListingOwner($user, $listing)) {
            return false;
        }

        $agent = $this->resolveAgent($listing);

        // Owners may publish if they have an assigned, verified agent.
        return $agent !== null && $agent->verified_at !== null;
    }
}

