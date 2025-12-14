<?php

namespace App\Services\Growth;

use Illuminate\Support\Facades\Config;

final class FeatureFlagService
{
    /**
     * Check if a feature is enabled.
     *
     * @param string $feature
     * @param bool $default
     * @return bool
     */
    public function isEnabled(string $feature, bool $default = false): bool
    {
        return Config::get("features.{$feature}", $default);
    }

    /**
     * Check if a growth feature is enabled.
     *
     * @param string $feature
     * @return bool
     */
    public function isGrowthFeatureEnabled(string $feature): bool
    {
        return $this->isEnabled("growth.{$feature}");
    }
}

