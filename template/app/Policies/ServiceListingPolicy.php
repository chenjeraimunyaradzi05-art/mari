<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\ServiceListing;
use App\Models\User;

final class ServiceListingPolicy
{


    public function create(User $user): bool
    {
        return $this->manage($user);
    }

    public function update(User $user, ServiceListing $listing): bool
    {
        return $this->manage($user) || (int) $listing->user_id === (int) $user->id;
    }

    public function delete(User $user, ServiceListing $listing): bool
    {
        return $this->update($user, $listing);
    }

    protected function manage(?User $user = null): bool
    {
        if ($user === null) {
            return false;
        }

        if (method_exists($user, 'hasAnyRole')) {
            return $user->hasAnyRole(['Super Admin', 'Admin', 'Moderator', 'Editor']);
        }

        return false;
    }

    /**
     * Whether a user can view a given service listing.
     *
     * Published listings should be viewable by visitors; otherwise require
     * privileges or ownership.
     */
    public function view(?User $user, ServiceListing $listing): bool
    {
        if ($listing->published_at !== null && $listing->published_at <= now()) {
            return true;
        }

        // allow management or owner to view unpublished listings
        return $this->manage($user) || ($user !== null && (int) $listing->user_id === (int) $user->id);
    }

    /**
     * Whether a user can express interest in a given listing (submit a lead).
     */
    public function expressInterest(?User $user, ServiceListing $listing): bool
    {
        // must be a logged-in user and the listing must be published
        if ($user === null) {
            return false;
        }

        return $listing->published_at !== null && $listing->published_at <= now();
    }
}

