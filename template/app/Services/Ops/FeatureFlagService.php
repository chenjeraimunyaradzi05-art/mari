<?php

namespace App\Services\Ops;

use App\Models\User;
use Illuminate\Support\Facades\Config;

final class FeatureFlagService
{
    public function isEnabled(string $feature, ?User $user = null): bool
    {
        // Support dot notation for nested config keys
        $configKey = "features.{$feature}";
        $config = Config::get($configKey);

        // If config is just a boolean, return it directly
        if (is_bool($config)) {
            return $config;
        }

        // If config is null, feature doesn't exist, default to false
        if (is_null($config)) {
            return false;
        }

        // If config is an array, check for 'enabled' key
        if (is_array($config)) {
            if (!isset($config['enabled']) || !$config['enabled']) {
                return false;
            }

            // If enabled is true, check other constraints

            // Check user allowlist
            if ($user && isset($config['allowed_users']) && is_array($config['allowed_users'])) {
                if (in_array($user->email, $config['allowed_users'])) {
                    return true;
                }
            }

            // Check country restrictions
            if ($user && isset($config['allowed_countries']) && is_array($config['allowed_countries'])) {
                // Assuming user has a country_code attribute or method
                $countryCode = $user->country_code ?? null;
                if ($countryCode && !in_array($countryCode, $config['allowed_countries'])) {
                    return false;
                }
            }

            // Gradual rollout based on percentage
            if (isset($config['rollout_percentage'])) {
                $percentage = (int) $config['rollout_percentage'];

                if ($percentage === 100) {
                    return true;
                }

                if ($percentage === 0) {
                    // If allowed_users didn't match above, and percentage is 0, then it's off
                    return false;
                }

                // Deterministic rollout based on user ID
                if ($user) {
                    // CRC32 returns an integer. We use abs to ensure it's positive.
                    // We combine user ID and feature name to ensure different features
                    // are enabled for different sets of users (avoiding "lucky user" syndrome)
                    $hash = crc32($user->id . $feature);
                    return (abs($hash) % 100) < $percentage;
                }
            }

            return true;
        }

        return false;
    }
}

