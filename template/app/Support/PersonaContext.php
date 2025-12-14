<?php

namespace App\Support;

use App\Models\User;

final class PersonaContext
{
    /**
     * @return ((array|bool|mixed|null|string)[]|mixed|null)[]
     *
     * @psalm-return array{profile_id?: mixed, persona?: array{type: string, label: mixed|null, badge: mixed|null, tagline: mixed|null}, privacy?: array{tier: string, level: string, dm_policy: string, tag_policy: string, mention_policy: string, location_visibility: string, is_private: bool}, preferences?: array{goals: array, interests: array, skills: array}, social_profile?: array{id: mixed, username: string, is_private: bool, persona_key: null|string, privacy_preferences: array|null}|null}
     */
    public static function forUser(?User $user): array
    {
        if (! $user) {
            return [];
        }

        $profile = ActiveProfile::forUser($user);

        if (! $profile) {
            return [];
        }

        $socialProfile = ActiveSocialProfile::forProfile($profile);
        $personaMeta = $profile->personaMeta();

        $privacy = [
            'tier' => $profile->privacyTier(),
            'level' => $profile->privacy_level,
            'dm_policy' => $profile->dm_policy,
            'tag_policy' => $profile->tag_policy,
            'mention_policy' => $profile->mention_policy,
            'location_visibility' => $profile->location_visibility,
            'is_private' => (bool) optional($socialProfile)->is_private,
        ];

        $socialPayload = $socialProfile ? [
            'id' => $socialProfile->getKey(),
            'username' => $socialProfile->username,
            'is_private' => (bool) $socialProfile->is_private,
            'persona_key' => $socialProfile->persona_key,
            'privacy_preferences' => $socialProfile->privacy_preferences,
        ] : null;

        return [
            'profile_id' => $profile->getKey(),
            'persona' => [
                'type' => $profile->persona_type,
                'label' => $personaMeta['label'] ?? null,
                'badge' => $personaMeta['badge'] ?? null,
                'tagline' => $personaMeta['tagline'] ?? null,
            ],
            'privacy' => $privacy,
            'preferences' => [
                'goals' => $profile->goals ?? [],
                'interests' => $profile->interests ?? [],
                'skills' => $profile->skills ?? [],
            ],
            'social_profile' => $socialPayload,
        ];
    }
}

