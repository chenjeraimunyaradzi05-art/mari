<?php

namespace App\Policies;

use App\Models\User;

final class RoleDashboardPolicy
{

    /**
     * Determine whether the given user can view the dashboard for a role.
     */
    public function view(User $user, string $role): bool
    {
        // super-admin/guardians and other override roles can always view
        if ($this->userHasOverrideAccess($user)) {
            return true;
        }

        $profile = $user->primaryPurposeProfile;

        if (!$profile || ! $profile->isComplete()) {
            return false;
        }

        $normalized = $this->normalizeRole($role);

        // Check the role's configured feature flag
        $roleFeatureFlag = config("dashboard_roles.roles.{$normalized}.feature_flag");

        // If the user's primary purpose matches the requested role
        // then allow access only when there is no role-level feature flag
        // or when the user's combined flags include the required flag.
        if ($profile->primary_purpose === $normalized) {
            if (! $roleFeatureFlag) {
                return true;
            }

            $flags = $this->collectFeatureFlagsForProfile($profile->primary_purpose ?? '', $profile->feature_flags ?? []);

            return in_array($roleFeatureFlag, $flags, true);
        }

        // Otherwise, check the user's combined feature flags (profile + defaults for their primary purpose)
        $flags = $this->collectFeatureFlagsForProfile($profile->primary_purpose ?? '', $profile->feature_flags ?? []);

        return $roleFeatureFlag && in_array($roleFeatureFlag, $flags, true);
    }


    private function userHasOverrideAccess(User $user): bool
    {
        if (method_exists($user, 'hasAnyRole') && $user->hasAnyRole([
            'admin',
            'administrator',
            'guardian',
            'guardian_team',
            'product_team',
        ])) {
            return true;
        }

        return false;
    }

    /**
     * @psalm-return list<mixed>
     */
    private function collectFeatureFlagsForProfile(string $profilePrimaryPurpose, array $profileFlags): array
    {
        $normalized = $this->normalizeRole($profilePrimaryPurpose ?: '');
        $defaultFlags = config("signup.primary_purposes.{$normalized}.feature_flags", []);

        return array_values(array_unique(array_merge($profileFlags, $defaultFlags)));
    }

    /**
     * Normalize role labels so synonyms like 'member' and 'candidate' are treated the same.
     */
    private function normalizeRole(string $role): string
    {
        $role = trim(strtolower($role ?: ''));

        if ($role === 'candidate') {
            return 'member';
        }

        return $role;
    }
}

