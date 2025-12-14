<?php

namespace App\Policies;

use App\Enums\SocialThreadParticipantStatus;
use App\Models\Profile;
use App\Models\SocialProfile;
use App\Models\SocialThread;
use App\Models\User;
use App\Support\ActiveProfile;

final class ConversationPolicy
{


    protected function resolveProfile(User $user): ?Profile
    {
        return ActiveProfile::forUser($user);
    }

    protected function resolveSocialProfile(?Profile $profile): ?SocialProfile
    {
        if (!$profile) {
            return null;
        }

        if ($profile->relationLoaded('personaSocialProfile')) {
            return $profile->personaSocialProfile;
        }

        return $profile->personaSocialProfile()->first();
    }

    public function view(User $user, SocialThread $thread): bool
    {
        $profile = $this->resolveProfile($user);

        if (!$profile) {
            return false;
        }

        $social = $this->resolveSocialProfile($profile);

        if (!$social) {
            return false;
        }

        // participant must exist and be active to view
        return $thread->participants()
            ->where('social_profile_id', $social->getKey())
            ->where('status', SocialThreadParticipantStatus::Active->value)
            ->exists();
    }
}

