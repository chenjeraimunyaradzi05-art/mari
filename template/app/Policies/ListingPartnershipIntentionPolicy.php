<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\ListingPartnershipIntention;
use App\Models\User;
use App\Models\WomenHousingListing;

final class ListingPartnershipIntentionPolicy
{


    public function create(User $user, WomenHousingListing $listing): bool
    {
        return $user->id !== null && $listing->exists;
    }

    public function delete(User $user, ListingPartnershipIntention $intention): bool
    {
        return (int) $user->id === (int) $intention->initiator_user_id;
    }
}

