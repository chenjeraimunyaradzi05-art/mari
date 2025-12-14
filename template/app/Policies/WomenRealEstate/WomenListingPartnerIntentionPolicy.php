<?php

declare(strict_types=1);

namespace App\Policies\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenListingPartnerIntention;
use Illuminate\Auth\Access\HandlesAuthorization;

final class WomenListingPartnerIntentionPolicy
{
    use HandlesAuthorization;

    public function create(User $user, WomenListing $listing): bool
    {
        return $this->isListingStakeholder($user, $listing);
    }

    public function update(User $user, WomenListingPartnerIntention $intention): bool
    {
        return $this->isStakeholder($user, $intention);
    }

    public function delete(User $user, WomenListingPartnerIntention $intention): bool
    {
        return $this->isStakeholder($user, $intention);
    }

    protected function isListingStakeholder(User $user, WomenListing $listing): bool
    {
        return $this->canModerate($user) || $listing->owner_id === $user->id;
    }

    protected function isStakeholder(User $user, WomenListingPartnerIntention $intention): bool
    {
        if ($this->canModerate($user)) {
            return true;
        }

        if ($intention->initiator_id === $user->id) {
            return true;
        }

        if ($intention->invitee_id !== null && $intention->invitee_id === $user->id) {
            return true;
        }

        $listing = $intention->listing;

        return $listing !== null && $listing->owner_id === $user->id;
    }

    protected function canModerate(User $user): bool
    {
        return method_exists($user, 'hasAnyRole')
            ? $user->hasAnyRole(['Super Admin', 'Admin', 'Moderator'])
            : false;
    }
}

