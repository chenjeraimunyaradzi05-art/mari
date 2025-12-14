<?php

namespace App\Services\Privacy;

use App\Models\Profile;
use App\Models\User;
use App\Support\ActiveProfile;
use App\Support\ActiveSocialProfile;
use App\Services\Privacy\PrivacyAccessLogger;

final class PrivacyTierService
{

    private PrivacyAccessLogger $logger;

    public function __construct(?PrivacyAccessLogger $logger = null)
    {
        $this->logger = $logger ?: app(PrivacyAccessLogger::class);
    }


    public function tiers(): array
    {
        return config('privacy.tiers', []);
    }

    public function defaultTier(): string
    {
        return (string) config('privacy.defaults.tier', 'network');
    }

    public function tierExists(string $tier): bool
    {
        return array_key_exists($tier, $this->tiers());
    }

    public function applyTier(Profile $profile, string $tier): void
    {
        if (! $this->tierExists($tier)) {
            return;
        }

        $config = $this->tiers()[$tier];
        $policies = $config['policies'] ?? [];

        $profile->privacy_tier = $tier;
        $profile->privacy_level = $policies['privacy_level'] ?? $profile->privacy_level;
        $profile->dm_policy = $policies['dm_policy'] ?? $profile->dm_policy;
        $profile->tag_policy = $policies['tag_policy'] ?? $profile->tag_policy;
        $profile->mention_policy = $policies['mention_policy'] ?? $profile->mention_policy;
        $profile->location_visibility = $policies['location_visibility'] ?? $profile->location_visibility;
    }

    public function shouldForcePrivate(Profile $profile): bool
    {
        $rules = config('privacy.vulnerable_cohorts', []);

        if (($rules['women_safety_mode'] ?? false) && $profile->women_safety_mode) {
            return true;
        }

        $ageBrackets = $rules['age_brackets'] ?? [];
        if (! empty($ageBrackets) && in_array($profile->age_bracket, $ageBrackets, true)) {
            return true;
        }

        $flags = $rules['safety_overrides_flags'] ?? [];
        if (! empty($flags)) {
            $overrides = $profile->safety_overrides ?? [];
            $flatOverrides = $this->flattenOverrideFlags($overrides);

            foreach ($flags as $flag) {
                if (in_array($flag, $flatOverrides, true)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @return (Profile|\App\Models\SocialProfile|array|null|string)[]
     *
     * @psalm-return array{tier: string, granted: list<mixed>, denied: list<mixed>, allowed: array, profile: Profile|null, social_profile: \App\Models\SocialProfile|null}
     */
    public function guardAnalytics(User $user, string $channel, array $requestedFields = [], array $metadata = []): array
    {
        $profile = ActiveProfile::forUser($user);
        $socialProfile = ActiveSocialProfile::forProfile($profile, false);
        $tier = $profile?->privacyTier() ?? $this->defaultTier();
        $allowed = $this->allowedAnalyticsFields($tier, $channel);

        $requested = empty($requestedFields) ? $allowed : array_values($requestedFields);
        $granted = array_values(array_intersect($allowed, $requested));
        $denied = array_values(array_diff($requested, $granted));
        $decision = empty($granted) ? 'blocked' : 'granted';

        $this->logger->log($user, $profile, $socialProfile, $channel, $tier, $requested, $granted, $denied, $decision, $metadata);

        return [
            'tier' => $tier,
            'granted' => $granted,
            'denied' => $denied,
            'allowed' => $allowed,
            'profile' => $profile,
            'social_profile' => $socialProfile,
        ];
    }

    /**
     * @psalm-return list<mixed>
     */
    public function allowedAnalyticsFields(?string $tier, string $channel): array
    {
        $tier = $tier && $this->tierExists($tier) ? $tier : $this->defaultTier();
        $config = $this->tiers()[$tier]['analytics'][$channel] ?? [];

        return array_values(array_unique($config));
    }

    /**
     * @return string[]
     *
     * @psalm-return list<string>
     */
    private function flattenOverrideFlags(array $overrides): array
    {
        $flattened = [];

        foreach ($overrides as $key => $value) {
            if (is_int($key) && is_string($value)) {
                $flattened[] = $value;
                continue;
            }

            if (is_string($key) && ($value === true || (is_string($value) && $value !== ''))) {
                $flattened[] = $key;
            }

            if (is_array($value)) {
                foreach ($value as $nestedKey => $nestedValue) {
                    if (is_int($nestedKey) && is_string($nestedValue)) {
                        $flattened[] = $nestedValue;
                        continue;
                    }

                    if (is_string($nestedKey) && ($nestedValue === true || (is_string($nestedValue) && $nestedValue !== ''))) {
                        $flattened[] = $nestedKey;
                    }
                }
            }
        }

        return array_values(array_unique($flattened));
    }
}

