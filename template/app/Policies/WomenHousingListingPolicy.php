<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WomenHousingListing;
use App\Support\IntentEvaluator;

final class WomenHousingListingPolicy
{

    /**
     * Determine whether the given user can view the listing.
     * Owner or public listings are viewable; non-owners cannot view private/community-only listings.
     */
    public function view(?User $user, WomenHousingListing $listing): bool
    {
        // Always allow the owner
        if ($user && $listing->owner_user_id === $user->id) {
            return true;
        }

        // Public listings are viewable by anyone
        if ($listing->visibility === 'public') {
            return true;
        }

        return false;
    }


    public function create(User $user): bool
    {
        return $user->hasVerifiedEmail()
            && IntentEvaluator::for($user)->allowsContext('housing');
    }

    public function update(User $user, WomenHousingListing $listing): bool
    {
        return $listing->owner_user_id === $user->id;
    }

    public function delete(User $user, WomenHousingListing $listing): bool
    {
        return $listing->owner_user_id === $user->id;
    }
}

